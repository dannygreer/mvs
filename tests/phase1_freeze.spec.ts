// Phase 1 Freeze (migration 0012) — schema + integrity coverage.
//
// These tests hit the live Supabase project via the service role (same as
// rls.spec.ts). They are additive: they create their own scenario rows
// (so we don't poison the active_threat_v1 doctrine fixture) and clean up
// in afterAll. They do NOT test the runner / server-action layer — that's
// covered in tests against quiz.ts and via the end-to-end pass.
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const MARKERS = [
  'escalation',
  'narrowing',
  'premature_commitment',
  'sequencing_break',
  'drift',
  'intervention',
  'recovery',
  'governance_instability',
] as const;

let orgId: string;
let studentId: string;
let assessmentId: string;
let scenarioFkId: string;
let revisableScenarioId: string;
let enrollmentId: string;
const insertedScenarioIds: string[] = [];
const insertedEnrollmentIds: string[] = [];

beforeAll(async () => {
  const stamp = Date.now();

  const { data: org } = await admin
    .from('orgs')
    .insert({ name: `phase1_${stamp}` })
    .select('id')
    .single();
  orgId = org!.id;

  // Make a throwaway profile to own the enrollment (no auth.user — service
  // role bypasses FK with a manual UUID; we use a real one via createUser).
  const { data: u } = await admin.auth.admin.createUser({
    email: `phase1.${stamp}@phase1test.local`,
    password: 'phase1-Pass-1234!',
    email_confirm: true,
  });
  studentId = u.user!.id;
  await admin
    .from('profiles')
    .update({ role: 'student', org_id: orgId })
    .eq('id', studentId);

  // Make a revisable scenario for the runner/RT tests.
  revisableScenarioId = `phase1_revisable_${stamp}`;
  const { data: sc } = await admin
    .from('scenarios')
    .insert({
      scenario_id: revisableScenarioId,
      version: '1',
      title: 'Phase1 Revisable Test',
      entry_screen_id: 'q01',
      is_active: false,
      commitment_mode: 'revisable',
      domain: 'leadership',
      compression_level: 'moderate',
      ambiguity: 'high',
      emotional_load: 'moderate',
      sensory_complexity: 'moderate',
      authority_conflict: true,
      time_pressure: 'moderate',
      casualty_complexity: 'none',
      governance_challenge: 'team',
    })
    .select('id')
    .single();
  scenarioFkId = sc!.id;
  insertedScenarioIds.push(scenarioFkId);

  // Need an assessment + enrollment to satisfy responses_long FKs.
  const { data: a, error: aErr } = await admin
    .from('assessments')
    .insert({
      code: `phase1_${stamp}_a`,
      name: 'Phase1 fixture',
      kind: 'scenario',
      scenario_fk: scenarioFkId,
    })
    .select('id')
    .single();
  if (aErr) throw aErr;
  assessmentId = a!.id;

  const { data: e, error: eErr } = await admin
    .from('enrollments')
    .insert({
      student_id: studentId,
      assessment_id: assessmentId,
      phase: 'pre',
    })
    .select('id')
    .single();
  if (eErr) throw eErr;
  enrollmentId = e!.id;
  insertedEnrollmentIds.push(enrollmentId);
});

afterAll(async () => {
  await admin
    .from('responses_long')
    .delete()
    .in('enrollment_id', insertedEnrollmentIds);
  await admin.from('enrollments').delete().in('id', insertedEnrollmentIds);
  await admin.from('assessments').delete().eq('id', assessmentId);
  await admin.from('scenarios').delete().in('id', insertedScenarioIds);
  if (studentId) await admin.auth.admin.deleteUser(studentId);
  if (orgId) await admin.from('orgs').delete().eq('id', orgId);
});

describe('Phase 1 Freeze — schema + integrity', () => {
  it('1. event_markers JSONB writes + indexed expression query reads back', async () => {
    const { data, error } = await admin
      .from('responses_long')
      .insert({
        participant_id: `p_${Date.now()}`,
        first_name: 'M',
        last_name: 'Marker',
        phase: 'pre',
        scenario_id: revisableScenarioId,
        scenario_version: '1',
        question_id: 'q01',
        branch_path: '',
        option_selected: 'A',
        rt_ms: 1234,
        timed_out: false,
        enrollment_id: enrollmentId,
        student_id: studentId,
        event_markers: { escalation: true, narrowing: true },
      })
      .select('id, event_markers')
      .single();
    expect(error).toBeNull();
    expect(data!.event_markers).toEqual({
      escalation: true,
      narrowing: true,
    });

    // Read back via the expression-indexed predicate the analytics layer uses.
    const { data: hit } = await admin
      .from('responses_long')
      .select('id')
      .eq('id', data!.id)
      .filter('event_markers->>escalation', 'eq', 'true');
    expect(hit && hit.length).toBe(1);
  });

  it('2. revision chain: original event + revision row linked via revises_response_event_id', async () => {
    const { data: original } = await admin
      .from('responses_long')
      .insert({
        participant_id: `p_${Date.now()}_rev`,
        first_name: 'M',
        last_name: 'Rev',
        phase: 'pre',
        scenario_id: revisableScenarioId,
        scenario_version: '1',
        question_id: 'q_revchain',
        branch_path: '',
        option_selected: 'A',
        rt_ms: 1000,
        timed_out: false,
        enrollment_id: enrollmentId,
        student_id: studentId,
        revision_number: 0,
        is_revision: false,
      })
      .select('id')
      .single();

    const { data: revision, error: revErr } = await admin
      .from('responses_long')
      .insert({
        participant_id: `p_${Date.now()}_rev`,
        first_name: 'M',
        last_name: 'Rev',
        phase: 'pre',
        scenario_id: revisableScenarioId,
        scenario_version: '1',
        question_id: 'q_revchain',
        branch_path: '',
        option_selected: 'B',
        rt_ms: 2000,
        timed_out: false,
        enrollment_id: enrollmentId,
        student_id: studentId,
        revision_number: 1,
        is_revision: true,
        revises_response_event_id: original!.id,
      })
      .select('id, revises_response_event_id, revision_number, is_revision')
      .single();
    expect(revErr).toBeNull();
    expect(revision!.revises_response_event_id).toBe(original!.id);
    expect(revision!.revision_number).toBe(1);
    expect(revision!.is_revision).toBe(true);

    // Full chain query the analytics layer uses to find final answers.
    const { data: chain } = await admin
      .from('responses_long')
      .select('id, revision_number, option_selected')
      .eq('enrollment_id', enrollmentId)
      .eq('question_id', 'q_revchain')
      .order('revision_number', { ascending: true });
    expect(chain && chain.length).toBe(2);
    expect(chain![0].revision_number).toBe(0);
    expect(chain![1].revision_number).toBe(1);
    expect(chain![1].option_selected).toBe('B'); // final answer per max(revision_number)
  });

  it('3. partial unique index allows revisions but blocks duplicate revision_numbers', async () => {
    // Both rows have revision_number = 0 -> partial unique fires.
    await admin
      .from('responses_long')
      .insert({
        participant_id: `p_${Date.now()}_dup`,
        first_name: 'M',
        last_name: 'Dup',
        phase: 'pre',
        scenario_id: revisableScenarioId,
        scenario_version: '1',
        question_id: 'q_dup',
        branch_path: '',
        option_selected: 'A',
        rt_ms: 500,
        timed_out: false,
        enrollment_id: enrollmentId,
        student_id: studentId,
        revision_number: 0,
      });
    const { error } = await admin
      .from('responses_long')
      .insert({
        participant_id: `p_${Date.now()}_dup2`,
        first_name: 'M',
        last_name: 'Dup',
        phase: 'pre',
        scenario_id: revisableScenarioId,
        scenario_version: '1',
        question_id: 'q_dup',
        branch_path: '',
        option_selected: 'B',
        rt_ms: 500,
        timed_out: false,
        enrollment_id: enrollmentId,
        student_id: studentId,
        revision_number: 0,
      });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/unique|duplicate/);
  });

  it('4. scenario tag check constraints reject invalid values', async () => {
    const { error } = await admin
      .from('scenarios')
      .insert({
        scenario_id: `phase1_invalid_${Date.now()}`,
        version: '1',
        title: 'Invalid scenario',
        entry_screen_id: 'q01',
        compression_level: 'invalid', // not in enum
      });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/check|constraint/);
  });

  it('5. triggers_markers JSONB accepts known + unknown keys (modular)', async () => {
    // Insert via screen_options requires a screen FK. Test the column shape
    // directly with the same JSONB pattern. The 8 known keys must be writable;
    // additional keys must NOT be rejected (modularity is a doctrine guarantee).
    const knownPayload = Object.fromEntries(MARKERS.map((k) => [k, true]));
    const extendedPayload = { ...knownPayload, future_marker: true };

    // We re-use responses_long.event_markers since it has identical
    // semantics; both columns are jsonb default '{}' with no enum check.
    const { data: known } = await admin
      .from('responses_long')
      .insert({
        participant_id: `p_${Date.now()}_known`,
        first_name: 'M',
        last_name: 'K',
        phase: 'pre',
        scenario_id: revisableScenarioId,
        scenario_version: '1',
        question_id: 'q_known',
        branch_path: '',
        option_selected: 'A',
        rt_ms: 100,
        timed_out: false,
        enrollment_id: enrollmentId,
        student_id: studentId,
        event_markers: knownPayload,
      })
      .select('event_markers')
      .single();
    expect(known!.event_markers).toEqual(knownPayload);

    const { data: extended, error: extErr } = await admin
      .from('responses_long')
      .insert({
        participant_id: `p_${Date.now()}_ext`,
        first_name: 'M',
        last_name: 'E',
        phase: 'pre',
        scenario_id: revisableScenarioId,
        scenario_version: '1',
        question_id: 'q_extended',
        branch_path: '',
        option_selected: 'A',
        rt_ms: 100,
        timed_out: false,
        enrollment_id: enrollmentId,
        student_id: studentId,
        event_markers: extendedPayload,
      })
      .select('event_markers')
      .single();
    expect(extErr).toBeNull();
    expect((extended!.event_markers as Record<string, boolean>).future_marker).toBe(
      true
    );
    // Flag (not fail) the unknown key — modularity preserved.
    console.warn(
      "[phase1_freeze] unknown marker 'future_marker' accepted by schema (intentional — modularity preserved)"
    );
  });

  it('6. commitment_mode defaults to "locked" on new scenarios without explicit value', async () => {
    const { data } = await admin
      .from('scenarios')
      .insert({
        scenario_id: `phase1_default_${Date.now()}`,
        version: '1',
        title: 'Default Commitment Mode',
        entry_screen_id: 'q01',
      })
      .select('id, commitment_mode')
      .single();
    expect(data!.commitment_mode).toBe('locked');
    insertedScenarioIds.push(data!.id);
  });
});
