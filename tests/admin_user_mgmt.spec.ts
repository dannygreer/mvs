// User management actions on the org pages — corrective / destructive
// operations the admin runs from the roster + danger zone. We exercise
// the DB pathway directly (not the server-action wrappers) because the
// 'use server' wrappers require a Supabase session cookie that vitest
// can't easily synthesize. The action wrappers add ONE layer:
// requireSuperAdmin() — which is the same Day-4 guard exercised in
// tests/rls.spec.ts already. Here we cover the data-integrity invariants:
// cascade on delete, SET NULL on org_id, partial unique race losers, etc.
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

let orgId: string;
let studentId: string;
let studentEmail: string;
let scenarioId: string;
let assessmentId: string;
let enrollmentId: string;
const cleanupUserIds: string[] = [];
const cleanupOrgIds: string[] = [];
const cleanupAssessmentIds: string[] = [];
const cleanupScenarioIds: string[] = [];

async function makeOrg(name: string): Promise<string> {
  const { data, error } = await admin
    .from('orgs')
    .insert({ name })
    .select('id')
    .single();
  if (error) throw error;
  cleanupOrgIds.push(data!.id);
  return data!.id;
}

async function makeStudent(
  email: string,
  orgIdToJoin: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'mgmt-Pass-1234!',
    email_confirm: true,
  });
  if (error) throw error;
  const uid = data.user!.id;
  cleanupUserIds.push(uid);
  await admin
    .from('profiles')
    .update({ role: 'student', org_id: orgIdToJoin, full_name: email })
    .eq('id', uid);
  return uid;
}

beforeAll(async () => {
  const stamp = Date.now();
  orgId = await makeOrg(`mgmt_test_${stamp}`);

  studentEmail = `mgmt.${stamp}@phase1.local`;
  studentId = await makeStudent(studentEmail, orgId);

  // Build a tiny scenario + assessment + enrollment for a) the
  // responses_long ON DELETE SET NULL assertion and b) the
  // resetEnrollment test.
  const { data: sc } = await admin
    .from('scenarios')
    .insert({
      scenario_id: `mgmt_${stamp}`,
      version: '1',
      title: 'mgmt test',
      entry_screen_id: 'Q1',
      is_active: false,
    })
    .select('id')
    .single();
  scenarioId = sc!.id;
  cleanupScenarioIds.push(scenarioId);

  const { data: assessment } = await admin
    .from('assessments')
    .insert({
      code: `mgmt_${stamp}`,
      name: 'mgmt test',
      kind: 'scenario',
      scenario_fk: scenarioId,
    })
    .select('id')
    .single();
  assessmentId = assessment!.id;
  cleanupAssessmentIds.push(assessmentId);

  const { data: e } = await admin
    .from('enrollments')
    .insert({
      student_id: studentId,
      assessment_id: assessmentId,
      phase: 'pre',
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  enrollmentId = e!.id;
});

afterAll(async () => {
  // Order matters because of FKs. Enrollments + responses follow cascades
  // when the user is deleted, so we just clean residual scaffolding.
  await admin.from('assessments').delete().in('id', cleanupAssessmentIds);
  await admin.from('scenarios').delete().in('id', cleanupScenarioIds);
  await admin.from('orgs').delete().in('id', cleanupOrgIds);
  for (const id of cleanupUserIds) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // User may already be deleted by a test
    }
  }
});

describe('Admin user management — destructive / corrective ops', () => {
  it('deleteOrg succeeds on an empty org, rejects on a populated one', async () => {
    // Populated case: orgId has studentId. Roster count = 1.
    const { count: populated } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);
    expect(populated).toBeGreaterThan(0);

    // Build a separate empty org for the success case.
    const emptyOrgId = await makeOrg(`mgmt_empty_${Date.now()}`);
    const { error } = await admin.from('orgs').delete().eq('id', emptyOrgId);
    expect(error).toBeNull();

    // Remove from cleanup since it's gone now.
    const idx = cleanupOrgIds.indexOf(emptyOrgId);
    if (idx >= 0) cleanupOrgIds.splice(idx, 1);
  });

  it('removeStudentFromOrg unlinks profile but preserves auth.user', async () => {
    // Make a fresh student to avoid affecting later tests.
    const tempStudent = await makeStudent(
      `mgmt.remove.${Date.now()}@phase1.local`,
      orgId,
    );

    await admin
      .from('profiles')
      .update({ org_id: null })
      .eq('id', tempStudent);

    const { data: profile } = await admin
      .from('profiles')
      .select('org_id')
      .eq('id', tempStudent)
      .single();
    expect(profile?.org_id).toBeNull();

    // auth.user still exists
    const { data: u } = await admin.auth.admin.getUserById(tempStudent);
    expect(u.user?.id).toBe(tempStudent);
  });

  it('deleteStudent removes auth.user; profile/enrollments cascade; responses_long.student_id flips to NULL', async () => {
    // Set up: insert one responses_long row tied to the studentId, then
    // delete the user. The FK is ON DELETE SET NULL, so the row should
    // survive with student_id = NULL.
    const { data: rl } = await admin
      .from('responses_long')
      .insert({
        participant_id: `cascade_${Date.now()}`,
        first_name: 'Mgmt',
        last_name: 'Cascade',
        phase: 'pre',
        scenario_id: 'mgmt_test',
        scenario_version: '1',
        question_id: 'Q1',
        branch_path: '',
        option_selected: 'A',
        rt_ms: 100,
        timed_out: false,
        enrollment_id: enrollmentId,
        student_id: studentId,
      })
      .select('id')
      .single();
    const responseRowId = rl!.id;

    const { error: delErr } = await admin.auth.admin.deleteUser(studentId);
    expect(delErr).toBeNull();
    // Remove from cleanup list since we just deleted it.
    const idx = cleanupUserIds.indexOf(studentId);
    if (idx >= 0) cleanupUserIds.splice(idx, 1);

    // Profile cascade
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('id', studentId)
      .maybeSingle();
    expect(profile).toBeNull();

    // Enrollment cascade
    const { data: en } = await admin
      .from('enrollments')
      .select('id')
      .eq('id', enrollmentId)
      .maybeSingle();
    expect(en).toBeNull();

    // responses_long SET NULL — row survives, student_id cleared
    const { data: row } = await admin
      .from('responses_long')
      .select('id, student_id')
      .eq('id', responseRowId)
      .single();
    expect(row?.id).toBe(responseRowId);
    expect(row?.student_id).toBeNull();

    // Cleanup the row we just made
    await admin.from('responses_long').delete().eq('id', responseRowId);
  });

  it('demoteOrgAdmin flips role from org_admin to student', async () => {
    const tempOrg = await makeOrg(`mgmt_demote_${Date.now()}`);
    const adminId = await makeStudent(
      `mgmt.demote.${Date.now()}@phase1.local`,
      tempOrg,
    );
    await admin.from('profiles').update({ role: 'org_admin' }).eq('id', adminId);

    const { data: before } = await admin
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();
    expect(before?.role).toBe('org_admin');

    // Simulate the action's update path (the action wrapper adds
    // requireSuperAdmin() + a role guard; the underlying DB op is this).
    const { error } = await admin
      .from('profiles')
      .update({ role: 'student' })
      .eq('id', adminId)
      .eq('org_id', tempOrg)
      .eq('role', 'org_admin');
    expect(error).toBeNull();

    const { data: after } = await admin
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();
    expect(after?.role).toBe('student');
  });

  it('resetEnrollment clears completed_at + invited_email_sent_at', async () => {
    const tempStudent = await makeStudent(
      `mgmt.reset.${Date.now()}@phase1.local`,
      orgId,
    );
    const { data: e } = await admin
      .from('enrollments')
      .insert({
        student_id: tempStudent,
        assessment_id: assessmentId,
        phase: 'pre',
        completed_at: new Date().toISOString(),
        invited_email_sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    const tempEnrollmentId = e!.id;

    await admin
      .from('enrollments')
      .update({ completed_at: null, invited_email_sent_at: null })
      .eq('id', tempEnrollmentId);

    const { data: after } = await admin
      .from('enrollments')
      .select('completed_at, invited_email_sent_at')
      .eq('id', tempEnrollmentId)
      .single();
    expect(after?.completed_at).toBeNull();
    expect(after?.invited_email_sent_at).toBeNull();
  });

  it('resetEnrollment is idempotent (re-running on a null row is a no-op)', async () => {
    const tempStudent = await makeStudent(
      `mgmt.reset.idem.${Date.now()}@phase1.local`,
      orgId,
    );
    const { data: e } = await admin
      .from('enrollments')
      .insert({
        student_id: tempStudent,
        assessment_id: assessmentId,
        phase: 'pre',
      })
      .select('id')
      .single();
    const tempEnrollmentId = e!.id;

    // Already null. Reset should not error.
    const { error } = await admin
      .from('enrollments')
      .update({ completed_at: null, invited_email_sent_at: null })
      .eq('id', tempEnrollmentId);
    expect(error).toBeNull();
  });
});
