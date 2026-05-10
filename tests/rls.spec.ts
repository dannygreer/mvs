import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_PASSWORD = 'rls-test-Pass-1234!';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type TestUser = { id: string; email: string };

let orgA: string;
let orgB: string;
let superAdmin: TestUser;
let orgAdminA: TestUser;
let orgAdminB: TestUser;
let studentA: TestUser;
let studentB: TestUser;

async function makeUser(
  email: string,
  role: 'super_admin' | 'org_admin' | 'student',
  orgId: string | null
): Promise<TestUser> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user!.id;
  // Trigger created profile w/ default role 'student'. Update to test role/org.
  const { error: upErr } = await admin
    .from('profiles')
    .update({ role, org_id: orgId })
    .eq('id', id);
  if (upErr) throw upErr;
  return { id, email };
}

// Cache one signed-in client per email. Supabase Auth rate-limits per IP
// (90 sign-ins/5min on free tier); each test was previously creating a fresh
// session, exceeding the limit once we crossed ~20 cases. Sessions persist
// for the test run; afterAll deletes the users.
const clientCache = new Map<string, SupabaseClient>();

async function userClient(email: string): Promise<SupabaseClient> {
  const cached = clientCache.get(email);
  if (cached) return cached;
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) throw error;
  clientCache.set(email, c);
  return c;
}

beforeAll(async () => {
  const stamp = Date.now();
  const tag = `rls_${stamp}`;

  const { data: oa, error: oaErr } = await admin
    .from('orgs')
    .insert({ name: `${tag}_A` })
    .select('id')
    .single();
  if (oaErr) throw oaErr;
  const { data: ob, error: obErr } = await admin
    .from('orgs')
    .insert({ name: `${tag}_B` })
    .select('id')
    .single();
  if (obErr) throw obErr;
  orgA = oa.id;
  orgB = ob.id;

  superAdmin = await makeUser(`super.${stamp}@rlstest.local`, 'super_admin', null);
  orgAdminA = await makeUser(`oa.a.${stamp}@rlstest.local`, 'org_admin', orgA);
  orgAdminB = await makeUser(`oa.b.${stamp}@rlstest.local`, 'org_admin', orgB);
  studentA = await makeUser(`s.a.${stamp}@rlstest.local`, 'student', orgA);
  studentB = await makeUser(`s.b.${stamp}@rlstest.local`, 'student', orgB);
});

afterAll(async () => {
  clientCache.clear();
  for (const u of [superAdmin, orgAdminA, orgAdminB, studentA, studentB]) {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  }
  if (orgA && orgB) {
    await admin.from('orgs').delete().in('id', [orgA, orgB]);
  }
});

describe('RLS — orgs', () => {
  it('super_admin sees both test orgs', async () => {
    const c = await userClient(superAdmin.email);
    const { data } = await c.from('orgs').select('id').in('id', [orgA, orgB]);
    expect(data?.map((r) => r.id).sort()).toEqual([orgA, orgB].sort());
  });

  it('org_admin sees only own org', async () => {
    const c = await userClient(orgAdminA.email);
    const { data } = await c.from('orgs').select('id').in('id', [orgA, orgB]);
    expect(data?.map((r) => r.id)).toEqual([orgA]);
  });

  it('student sees only own org', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c.from('orgs').select('id').in('id', [orgA, orgB]);
    expect(data?.map((r) => r.id)).toEqual([orgA]);
  });
});

describe('RLS — profiles', () => {
  it('org_admin reads only profiles in own org', async () => {
    const c = await userClient(orgAdminA.email);
    const { data } = await c
      .from('profiles')
      .select('id')
      .in('id', [studentA.id, studentB.id, orgAdminB.id]);
    const ids = (data ?? []).map((r) => r.id).sort();
    // Should see studentA (own org) but NOT studentB or orgAdminB.
    expect(ids).toEqual([studentA.id].sort());
  });

  it('student reads own profile', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c
      .from('profiles')
      .select('id, role')
      .eq('id', studentA.id)
      .single();
    expect(data?.id).toBe(studentA.id);
    expect(data?.role).toBe('student');
  });

  it('student cannot read another student profile', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c
      .from('profiles')
      .select('id')
      .eq('id', studentB.id);
    expect(data ?? []).toEqual([]);
  });

  it('student cannot self-promote to super_admin', async () => {
    const c = await userClient(studentA.email);
    await c.from('profiles').update({ role: 'super_admin' }).eq('id', studentA.id);
    const { data: after } = await admin
      .from('profiles')
      .select('role')
      .eq('id', studentA.id)
      .single();
    expect(after?.role).toBe('student');
  });

  it('student cannot move themselves to another org', async () => {
    const c = await userClient(studentA.email);
    await c.from('profiles').update({ org_id: orgB }).eq('id', studentA.id);
    const { data: after } = await admin
      .from('profiles')
      .select('org_id')
      .eq('id', studentA.id)
      .single();
    expect(after?.org_id).toBe(orgA);
  });
});

describe('RLS — content (scenarios/screens/options)', () => {
  it('anonymous client cannot read scenarios', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data } = await anon.from('scenarios').select('id');
    expect(data ?? []).toEqual([]);
  });

  it('authenticated student can read scenarios', async () => {
    const c = await userClient(studentA.email);
    const { data, error } = await c.from('scenarios').select('id');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('super_admin can insert + delete a scenario', async () => {
    const c = await userClient(superAdmin.email);
    const { data, error } = await c
      .from('scenarios')
      .insert({
        scenario_id: `rls_${Date.now()}`,
        version: '1',
        title: 'rls test',
        entry_screen_id: 'S1',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    if (data) await admin.from('scenarios').delete().eq('id', data.id);
  });

  it('org_admin cannot insert a scenario', async () => {
    const c = await userClient(orgAdminA.email);
    const { error } = await c.from('scenarios').insert({
      scenario_id: `rls_should_fail_${Date.now()}`,
      version: '1',
      title: 'denied',
      entry_screen_id: 'S1',
    });
    expect(error).not.toBeNull();
  });
});

describe('RLS — responses', () => {
  it('student cannot read responses_long', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c.from('responses_long').select('id').limit(1);
    expect(data ?? []).toEqual([]);
  });

  it('org_admin cannot read responses_long (until 0005 adds org_id link)', async () => {
    const c = await userClient(orgAdminA.email);
    const { data } = await c.from('responses_long').select('id').limit(1);
    expect(data ?? []).toEqual([]);
  });
});

describe('RLS — assessments + enrollments (0004)', () => {
  let testAssessmentId: string;
  let enrollmentA: string;
  let enrollmentB: string;

  beforeAll(async () => {
    // Reuse the backfilled active_threat_v1 assessment.
    const { data: a, error: aErr } = await admin
      .from('assessments')
      .select('id')
      .eq('code', 'active_threat_v1')
      .single();
    if (aErr || !a) throw aErr ?? new Error('active_threat_v1 missing');
    testAssessmentId = a.id;

    const { data: e1 } = await admin
      .from('enrollments')
      .insert({
        student_id: studentA.id,
        assessment_id: testAssessmentId,
        phase: 'pre',
      })
      .select('id')
      .single();
    enrollmentA = e1!.id;

    const { data: e2 } = await admin
      .from('enrollments')
      .insert({
        student_id: studentB.id,
        assessment_id: testAssessmentId,
        phase: 'pre',
      })
      .select('id')
      .single();
    enrollmentB = e2!.id;
  });

  afterAll(async () => {
    if (enrollmentA || enrollmentB) {
      await admin
        .from('enrollments')
        .delete()
        .in('id', [enrollmentA, enrollmentB].filter(Boolean));
    }
  });

  it('super_admin can insert/update/delete assessments', async () => {
    const c = await userClient(superAdmin.email);
    const code = `mc_test_${Date.now()}`;
    const { data: ins, error: insErr } = await c
      .from('assessments')
      .insert({ code, name: 'mc test', kind: 'multi_choice' })
      .select('id')
      .single();
    expect(insErr).toBeNull();
    expect(ins?.id).toBeTruthy();

    const { error: upErr } = await c
      .from('assessments')
      .update({ name: 'renamed' })
      .eq('id', ins!.id);
    expect(upErr).toBeNull();

    const { error: delErr } = await c
      .from('assessments')
      .delete()
      .eq('id', ins!.id);
    expect(delErr).toBeNull();
  });

  it('student can read active assessments', async () => {
    const c = await userClient(studentA.email);
    const { data, error } = await c
      .from('assessments')
      .select('id, code')
      .eq('id', testAssessmentId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it('student reads own enrollment, not another students', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c
      .from('enrollments')
      .select('id')
      .in('id', [enrollmentA, enrollmentB]);
    expect((data ?? []).map((r) => r.id)).toEqual([enrollmentA]);
  });

  it('student can insert own responses_long; cannot insert under another student', async () => {
    const c = await userClient(studentA.email);
    const baseRow = {
      participant_id: `rls_${studentA.id}`,
      first_name: 'A',
      last_name: 'Test',
      phase: 'pre' as const,
      scenario_id: 'active_threat_v1',
      scenario_version: '1',
      question_id: 'S1_START',
      branch_path: '',
      option_selected: 'A1',
      response_category: 'controlled',
      rt_ms: 1500,
      timed_out: false,
      enrollment_id: enrollmentA,
    };

    // Self insert allowed.
    const { data: ok, error: okErr } = await c
      .from('responses_long')
      .insert({ ...baseRow, student_id: studentA.id })
      .select('id')
      .single();
    expect(okErr).toBeNull();
    expect(ok?.id).toBeTruthy();
    if (ok) await admin.from('responses_long').delete().eq('id', ok.id);

    // Insert with another student's id should be blocked.
    const { error: badErr } = await c
      .from('responses_long')
      .insert({ ...baseRow, student_id: studentB.id });
    expect(badErr).not.toBeNull();
  });

  it('student selects own responses, not anothers; org_admin scoped to own org', async () => {
    // Seed one row for each student via service role.
    const seedFor = async (uid: string) => {
      const { data } = await admin
        .from('responses_long')
        .insert({
          participant_id: `seed_${uid}`,
          first_name: 'X',
          last_name: 'Y',
          phase: 'pre',
          scenario_id: 'active_threat_v1',
          scenario_version: '1',
          question_id: 'S1_START',
          branch_path: '',
          option_selected: 'A1',
          response_category: 'controlled',
          rt_ms: 1234,
          timed_out: false,
          student_id: uid,
        })
        .select('id')
        .single();
      return data!.id as number;
    };
    const idA = await seedFor(studentA.id);
    const idB = await seedFor(studentB.id);

    try {
      // studentA sees own only.
      const sa = await userClient(studentA.email);
      const { data: saRows } = await sa
        .from('responses_long')
        .select('id, student_id')
        .in('id', [idA, idB]);
      expect((saRows ?? []).map((r) => r.id)).toEqual([idA]);

      // org_admin in orgA sees studentA's rows only.
      const oa = await userClient(orgAdminA.email);
      const { data: oaRows } = await oa
        .from('responses_long')
        .select('id, student_id')
        .in('id', [idA, idB]);
      expect((oaRows ?? []).map((r) => r.id)).toEqual([idA]);

      // org_admin in orgB sees studentB's rows only.
      const ob = await userClient(orgAdminB.email);
      const { data: obRows } = await ob
        .from('responses_long')
        .select('id, student_id')
        .in('id', [idA, idB]);
      expect((obRows ?? []).map((r) => r.id)).toEqual([idB]);
    } finally {
      await admin.from('responses_long').delete().in('id', [idA, idB]);
    }
  });

  it('student can mark own enrollment complete but cannot reassign it', async () => {
    const c = await userClient(studentA.email);

    // Allowed: set completed_at on own enrollment.
    const completedAt = new Date().toISOString();
    const { error: okErr } = await c
      .from('enrollments')
      .update({ completed_at: completedAt })
      .eq('id', enrollmentA);
    expect(okErr).toBeNull();

    const { data: after1 } = await admin
      .from('enrollments')
      .select('completed_at, assessment_id, phase, student_id')
      .eq('id', enrollmentA)
      .single();
    expect(after1?.completed_at).toBeTruthy();

    // Blocked: try to swap student_id, assessment_id, phase.
    await c
      .from('enrollments')
      .update({
        student_id: studentB.id,
        phase: 'post',
      })
      .eq('id', enrollmentA);

    const { data: after2 } = await admin
      .from('enrollments')
      .select('student_id, phase, assessment_id')
      .eq('id', enrollmentA)
      .single();
    expect(after2?.student_id).toBe(studentA.id);
    expect(after2?.phase).toBe('pre');
    expect(after2?.assessment_id).toBe(testAssessmentId);
  });
});

describe('RLS — multi-choice (0007)', () => {
  let mcAssessmentId: string;
  let inactiveAssessmentId: string;
  let inactiveQuestionId: string;

  beforeAll(async () => {
    const { data: a } = await admin
      .from('assessments')
      .select('id')
      .eq('code', 'mvs_test_bank_v1')
      .single();
    mcAssessmentId = a!.id;

    // Create an inactive multi-choice assessment + a question to assert
    // students can't read content from inactive assessments.
    const code = `inactive_mc_${Date.now()}`;
    const { data: ia } = await admin
      .from('assessments')
      .insert({
        code,
        name: 'inactive mc',
        kind: 'multi_choice',
        is_active: false,
      })
      .select('id')
      .single();
    inactiveAssessmentId = ia!.id;
    const { data: iq } = await admin
      .from('mc_questions')
      .insert({
        assessment_id: inactiveAssessmentId,
        sequence: 1,
        prompt: 'inactive Q',
      })
      .select('id')
      .single();
    inactiveQuestionId = iq!.id;
  });

  afterAll(async () => {
    if (inactiveQuestionId) {
      await admin.from('mc_questions').delete().eq('id', inactiveQuestionId);
    }
    if (inactiveAssessmentId) {
      await admin.from('assessments').delete().eq('id', inactiveAssessmentId);
    }
  });

  it('super_admin can insert + select mc_questions', async () => {
    const c = await userClient(superAdmin.email);
    const { data, error: insErr } = await c
      .from('mc_questions')
      .insert({
        assessment_id: mcAssessmentId,
        sequence: 9999,
        prompt: 'rls test prompt',
      })
      .select('id')
      .single();
    expect(insErr).toBeNull();
    expect(data?.id).toBeTruthy();
    if (data) await admin.from('mc_questions').delete().eq('id', data.id);
  });

  it('student can read mc_questions for the active Test Bank assessment', async () => {
    const c = await userClient(studentA.email);
    const { data, error } = await c
      .from('mc_questions')
      .select('id, sequence')
      .eq('assessment_id', mcAssessmentId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(50);
  });

  it('student CANNOT read mc_questions for an inactive assessment', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c
      .from('mc_questions')
      .select('id')
      .eq('id', inactiveQuestionId);
    expect(data ?? []).toEqual([]);
  });

  it('anonymous client CANNOT read mc_questions', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data } = await anon
      .from('mc_questions')
      .select('id')
      .eq('assessment_id', mcAssessmentId);
    expect(data ?? []).toEqual([]);
  });

  it('enrollment_scores: super_admin sees own test enrollments; org_admin scoped to own org; cross-org blocked', async () => {
    // Seed: enrollment for studentA against the active assessment.
    const { data: assessment } = await admin
      .from('assessments')
      .select('id')
      .eq('code', 'active_threat_v1')
      .single();
    const { data: enrollA } = await admin
      .from('enrollments')
      .insert({
        student_id: studentA.id,
        assessment_id: assessment!.id,
        phase: 'practice',
      })
      .select('id')
      .single();
    const { data: enrollB } = await admin
      .from('enrollments')
      .insert({
        student_id: studentB.id,
        assessment_id: assessment!.id,
        phase: 'practice',
      })
      .select('id')
      .single();

    try {
      // super_admin sees both
      const sa = await userClient(superAdmin.email);
      const { data: saRows } = await sa
        .from('enrollment_scores')
        .select('enrollment_id, org_id')
        .in('enrollment_id', [enrollA!.id, enrollB!.id]);
      expect((saRows ?? []).length).toBe(2);

      // org_admin in orgA sees only enrollment in orgA
      const oa = await userClient(orgAdminA.email);
      const { data: oaRows } = await oa
        .from('enrollment_scores')
        .select('enrollment_id, org_id')
        .in('enrollment_id', [enrollA!.id, enrollB!.id]);
      expect((oaRows ?? []).map((r) => r.enrollment_id)).toEqual([enrollA!.id]);

      // org_admin in orgB sees only enrollment in orgB
      const ob = await userClient(orgAdminB.email);
      const { data: obRows } = await ob
        .from('enrollment_scores')
        .select('enrollment_id, org_id')
        .in('enrollment_id', [enrollA!.id, enrollB!.id]);
      expect((obRows ?? []).map((r) => r.enrollment_id)).toEqual([enrollB!.id]);
    } finally {
      await admin
        .from('enrollments')
        .delete()
        .in('id', [enrollA!.id, enrollB!.id]);
    }
  });

  it('enrollment_scores: pass=true when score >= 80%, false when below', async () => {
    const { data: mcAssessment } = await admin
      .from('assessments')
      .select('id')
      .eq('code', 'mvs_test_bank_v1')
      .single();
    const { data: mcQuestions } = await admin
      .from('mc_questions')
      .select('sequence, mc_options(label, is_correct)')
      .eq('assessment_id', mcAssessment!.id)
      .order('sequence');

    // Pull the answer key.
    const correctByQ = new Map<number, string>();
    for (const q of mcQuestions ?? []) {
      const correctOpt = (q.mc_options as { label: string; is_correct: boolean }[]).find(
        (o) => o.is_correct
      );
      if (correctOpt) correctByQ.set(q.sequence as number, correctOpt.label);
    }

    // Create a fresh enrollment for the score test.
    const { data: scored } = await admin
      .from('enrollments')
      .insert({
        student_id: studentA.id,
        assessment_id: mcAssessment!.id,
        phase: 'practice',
      })
      .select('id')
      .single();

    try {
      // Insert exactly 41 correct answers + 9 wrong = 82% → pass.
      const rows: Record<string, unknown>[] = [];
      for (let i = 1; i <= 50; i++) {
        const correctLabel = correctByQ.get(i) ?? 'B';
        const wrongLabel = ['A', 'B', 'C', 'D'].find((l) => l !== correctLabel) ?? 'A';
        const useCorrect = i <= 41;
        rows.push({
          participant_id: 'score_test',
          first_name: 'Score',
          last_name: 'Test',
          phase: 'practice',
          scenario_id: 'mvs_test_bank_v1',
          scenario_version: '1',
          question_id: `q${String(i).padStart(2, '0')}`,
          branch_path: '',
          option_selected: useCorrect ? correctLabel : wrongLabel,
          response_category: null,
          rt_ms: 1000 + i,
          timed_out: false,
          enrollment_id: scored!.id,
          student_id: studentA.id,
        });
      }
      const { error: insErr } = await admin.from('responses_long').insert(rows);
      expect(insErr).toBeNull();

      const { data: passRow } = await admin
        .from('enrollment_scores')
        .select('correct_count, score_percent, pass')
        .eq('enrollment_id', scored!.id)
        .single();
      expect(passRow?.correct_count).toBe(41);
      expect(Number(passRow?.score_percent)).toBe(82);
      expect(passRow?.pass).toBe(true);

      // Now flip one row to wrong → 40/50 = 80% (still pass — boundary).
      // Then drop another → 39/50 = 78% → fail.
      await admin
        .from('responses_long')
        .delete()
        .eq('enrollment_id', scored!.id);
      const fail = rows.map((r, idx) => ({
        ...r,
        option_selected: idx < 39 ? r.option_selected : 'X', // 39 right, 11 'X' (treated wrong)
      }));
      // Use valid letters; 'X' would violate option set. Use a deliberate wrong label.
      for (let i = 0; i < fail.length; i++) {
        if (i >= 39) {
          const correct = correctByQ.get((fail[i] as { question_id: string }).question_id ? i + 1 : i + 1);
          const wrong = ['A', 'B', 'C', 'D'].find((l) => l !== correct) ?? 'A';
          fail[i] = { ...fail[i], option_selected: wrong };
        }
      }
      await admin.from('responses_long').insert(fail);

      const { data: failRow } = await admin
        .from('enrollment_scores')
        .select('correct_count, score_percent, pass')
        .eq('enrollment_id', scored!.id)
        .single();
      expect(failRow?.correct_count).toBe(39);
      expect(failRow?.pass).toBe(false);
    } finally {
      await admin.from('responses_long').delete().eq('enrollment_id', scored!.id);
      await admin.from('enrollments').delete().eq('id', scored!.id);
    }
  });

  it('loadMcQuestionsForStudent never returns is_correct or response_category', async () => {
    // Direct check on the loader contract — even if the underlying RLS lets
    // students read those columns via raw supabase-js, our loader must strip
    // them. Import via the dynamic path to avoid Next-only deps.
    const mod = await import('@/lib/db');
    const questions = await mod.loadMcQuestionsForStudent(mcAssessmentId);
    expect(questions.length).toBe(50);
    for (const q of questions) {
      expect(Object.keys(q)).not.toContain('is_correct');
      expect(Object.keys(q)).not.toContain('response_category');
      for (const opt of q.options) {
        expect(Object.keys(opt)).not.toContain('is_correct');
        expect(Object.keys(opt)).not.toContain('response_category');
      }
    }
  });
});
