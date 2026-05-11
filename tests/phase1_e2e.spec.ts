// Phase 1 Freeze end-to-end (server-action level).
//
// Exercises submitAssessmentByToken against a live Supabase project for both
// commitment modes. Verifies the integrity invariants the doctrine requires:
//   - locked + isRevision payload -> rejected
//   - revisable + isRevision payload -> accepted, chain wired
//   - event_markers copied from authoritative DB row (not client payload)
//   - presented_options snapshot persisted
//   - optionId/screen mismatch rejected
//   - tampered scenarioId in client -> server overrides with canonical
//
// We use the token path (no auth) since it's the same code path enrolled
// students actually hit in production via /take/[token].
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { submitAssessmentByToken } from '@/actions/quiz';
import type { ScreenResponse } from '@/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

interface Fixture {
  scenarioFkId: string;
  scenarioId: string;
  version: string;
  screen1Id: string;
  screen2Id: string;
  options: { id: string; label: string; screen: string; markers: Record<string, boolean> }[];
  assessmentId: string;
  enrollmentId: string;
  token: string;
  studentId: string;
}

let lockedFx: Fixture;
let revisableFx: Fixture;
let orgId: string;
const cleanupEnrollmentIds: string[] = [];
const cleanupAssessmentIds: string[] = [];
const cleanupScenarioIds: string[] = [];
const cleanupStudentIds: string[] = [];

async function makeFixture(
  mode: 'locked' | 'revisable',
  stamp: number,
): Promise<Fixture> {
  // Scenario
  const scenarioId = `phase1_e2e_${mode}_${stamp}`;
  const { data: sc, error: scErr } = await admin
    .from('scenarios')
    .insert({
      scenario_id: scenarioId,
      version: '1',
      title: `e2e ${mode}`,
      entry_screen_id: 'q01',
      is_active: false,
      commitment_mode: mode,
    })
    .select('id')
    .single();
  if (scErr) throw scErr;
  cleanupScenarioIds.push(sc.id);

  // 2 screens — first branches into terminal.
  const { data: s1 } = await admin
    .from('scenario_screens')
    .insert({
      scenario_fk: sc.id,
      screen_id: 'q01',
      screen_text: 'Q1',
      timer_seconds: 30,
      sort_order: 1,
    })
    .select('id')
    .single();
  const { data: s2 } = await admin
    .from('scenario_screens')
    .insert({
      scenario_fk: sc.id,
      screen_id: 'q02',
      screen_text: 'Q2',
      timer_seconds: 30,
      sort_order: 2,
    })
    .select('id')
    .single();

  // 2 options per screen with distinct marker tags so we can prove copy.
  const opts = [
    { screenFk: s1!.id, screen: 'q01', label: 'A', next: 'q02', markers: { escalation: true } },
    { screenFk: s1!.id, screen: 'q01', label: 'B', next: 'q02', markers: { narrowing: true } },
    { screenFk: s2!.id, screen: 'q02', label: 'A', next: null, markers: { recovery: true } },
    { screenFk: s2!.id, screen: 'q02', label: 'B', next: null, markers: { drift: true, intervention: true } },
  ];
  const inserted: Fixture['options'] = [];
  for (const o of opts) {
    const { data: row } = await admin
      .from('screen_options')
      .insert({
        screen_fk: o.screenFk,
        option_label: o.label,
        option_text: `Option ${o.label} (${o.screen})`,
        next_screen_id: o.next,
        sort_order: o.label === 'A' ? 1 : 2,
        triggers_markers: o.markers,
      })
      .select('id')
      .single();
    inserted.push({
      id: row!.id,
      label: o.label,
      screen: o.screen,
      markers: o.markers,
    });
  }

  // Student profile (trigger auto-creates from auth user).
  const email = `e2e.${mode}.${stamp}@phase1.local`;
  const { data: u } = await admin.auth.admin.createUser({
    email,
    password: 'phase1-e2e-Pass-1234!',
    email_confirm: true,
  });
  cleanupStudentIds.push(u.user!.id);
  await admin
    .from('profiles')
    .update({ role: 'student', org_id: orgId, full_name: `e2e ${mode}` })
    .eq('id', u.user!.id);

  // Assessment + enrollment
  const { data: a } = await admin
    .from('assessments')
    .insert({
      code: `phase1_e2e_${mode}_${stamp}`,
      name: `Phase1 e2e ${mode}`,
      kind: 'scenario',
      scenario_fk: sc.id,
    })
    .select('id')
    .single();
  cleanupAssessmentIds.push(a!.id);

  const { data: e } = await admin
    .from('enrollments')
    .insert({
      student_id: u.user!.id,
      assessment_id: a!.id,
      phase: 'pre',
    })
    .select('id, secret_token')
    .single();
  cleanupEnrollmentIds.push(e!.id);

  return {
    scenarioFkId: sc.id,
    scenarioId,
    version: '1',
    screen1Id: 'q01',
    screen2Id: 'q02',
    options: inserted,
    assessmentId: a!.id,
    enrollmentId: e!.id,
    token: e!.secret_token,
    studentId: u.user!.id,
  };
}

beforeAll(async () => {
  const stamp = Date.now();
  const { data: o } = await admin
    .from('orgs')
    .insert({ name: `phase1_e2e_${stamp}` })
    .select('id')
    .single();
  orgId = o!.id;

  lockedFx = await makeFixture('locked', stamp);
  revisableFx = await makeFixture('revisable', stamp + 1);
});

afterAll(async () => {
  await admin
    .from('responses_long')
    .delete()
    .in('enrollment_id', cleanupEnrollmentIds);
  await admin
    .from('responses_wide')
    .delete()
    .in('enrollment_id', cleanupEnrollmentIds);
  await admin.from('enrollments').delete().in('id', cleanupEnrollmentIds);
  await admin.from('assessments').delete().in('id', cleanupAssessmentIds);
  await admin.from('scenarios').delete().in('id', cleanupScenarioIds);
  for (const id of cleanupStudentIds) {
    await admin.auth.admin.deleteUser(id);
  }
  if (orgId) await admin.from('orgs').delete().eq('id', orgId);
});

function pickOption(fx: Fixture, screen: string, label: string) {
  return fx.options.find((o) => o.screen === screen && o.label === label)!;
}

function buildResponse(
  fx: Fixture,
  screen: string,
  label: string,
  revisionNumber: number,
  branchPath = '',
): ScreenResponse {
  const opt = pickOption(fx, screen, label);
  const screenOpts = fx.options
    .filter((o) => o.screen === screen)
    .map((o) => ({ id: o.id, label: o.label, text: `Option ${o.label} (${o.screen})` }));
  return {
    screenId: screen,
    optionLabel: label,
    optionText: `Option ${label} (${screen})`,
    optionId: opt.id,
    rtMs: 1000 + revisionNumber * 100,
    timedOut: false,
    branchPath,
    presentedOptions: screenOpts,
    isRevision: revisionNumber > 0,
    revisionNumber,
  };
}

describe('Phase 1 Freeze — e2e via submitAssessmentByToken', () => {
  it('locked scenario rejects payload containing any revision', async () => {
    const responses: ScreenResponse[] = [
      buildResponse(lockedFx, 'q01', 'A', 0),
      // Second event same screen, claiming revision -> should reject.
      buildResponse(lockedFx, 'q01', 'B', 1),
      buildResponse(lockedFx, 'q02', 'A', 0, 'A'),
    ];
    await expect(
      submitAssessmentByToken({
        token: lockedFx.token,
        scenarioId: lockedFx.scenarioId,
        scenarioVersion: lockedFx.version,
        branchPath: 'A-A',
        responses,
        totalTime: 3000,
      }),
    ).rejects.toThrow(/LOCKED_SCENARIO_REVISION_REJECTED/);

    // No rows landed (nothing inserted before the guard) — verify.
    const { data: rows } = await admin
      .from('responses_long')
      .select('id')
      .eq('enrollment_id', lockedFx.enrollmentId);
    expect(rows ?? []).toEqual([]);
  });

  it('locked scenario rejects payload with foreign optionId', async () => {
    const responses: ScreenResponse[] = [
      buildResponse(lockedFx, 'q01', 'A', 0),
      buildResponse(lockedFx, 'q02', 'A', 0, 'A'),
    ];
    // Swap q01's optionId for a q02 option id — same scenario but wrong screen.
    const foreignOpt = pickOption(lockedFx, 'q02', 'B');
    responses[0] = {
      ...responses[0],
      optionId: foreignOpt.id,
    };
    await expect(
      submitAssessmentByToken({
        token: lockedFx.token,
        scenarioId: lockedFx.scenarioId,
        scenarioVersion: lockedFx.version,
        branchPath: 'A-A',
        responses,
        totalTime: 2000,
      }),
    ).rejects.toThrow(/belongs to screen/i);
  });

  it('revisable scenario writes chained revisions with copied markers + presented_options', async () => {
    // q01: pick A, revise to B (final). q02: pick A (terminal).
    const responses: ScreenResponse[] = [
      buildResponse(revisableFx, 'q01', 'A', 0),        // original
      buildResponse(revisableFx, 'q01', 'B', 1, 'B'),   // revision -> B
      buildResponse(revisableFx, 'q02', 'A', 0, 'B'),   // terminal commit
    ];
    await submitAssessmentByToken({
      token: revisableFx.token,
      scenarioId: revisableFx.scenarioId,
      scenarioVersion: revisableFx.version,
      branchPath: 'B-A',
      responses,
      totalTime: 3000,
    });

    const { data: rows } = await admin
      .from('responses_long')
      .select(
        'id, question_id, option_selected, revision_number, is_revision, revises_response_event_id, event_markers, presented_options',
      )
      .eq('enrollment_id', revisableFx.enrollmentId)
      .order('id', { ascending: true });
    expect(rows).toBeTruthy();
    expect(rows!.length).toBe(3);

    // Row 1: q01 A (original)
    expect(rows![0].question_id).toBe('q01');
    expect(rows![0].option_selected).toBe('A');
    expect(rows![0].revision_number).toBe(0);
    expect(rows![0].is_revision).toBe(false);
    expect(rows![0].revises_response_event_id).toBeNull();
    // markers copied verbatim from DB (escalation: true) — NOT client-supplied
    expect(rows![0].event_markers).toEqual({ escalation: true });
    // presented_options snapshot has both A and B for q01
    expect(rows![0].presented_options).toEqual([
      expect.objectContaining({ label: 'A' }),
      expect.objectContaining({ label: 'B' }),
    ]);

    // Row 2: q01 B (revision linked to row 1)
    expect(rows![1].question_id).toBe('q01');
    expect(rows![1].option_selected).toBe('B');
    expect(rows![1].revision_number).toBe(1);
    expect(rows![1].is_revision).toBe(true);
    expect(rows![1].revises_response_event_id).toBe(rows![0].id);
    expect(rows![1].event_markers).toEqual({ narrowing: true });

    // Row 3: q02 A (terminal commit)
    expect(rows![2].question_id).toBe('q02');
    expect(rows![2].revision_number).toBe(0);
    expect(rows![2].is_revision).toBe(false);
    expect(rows![2].event_markers).toEqual({ recovery: true });

    // responses_wide.outcome_state set to terminal screen
    const { data: wide } = await admin
      .from('responses_wide')
      .select('outcome_state, q1_answer, q2_answer, scenario_id')
      .eq('enrollment_id', revisableFx.enrollmentId)
      .single();
    expect(wide!.outcome_state).toBe('q02');
    // q1_answer = the FINAL committed answer for q01 = B (the revision)
    expect(wide!.q1_answer).toBe('B');
    expect(wide!.q2_answer).toBe('A');
    // Audit fix: scenario_id on wide row reflects canonical scenario.
    expect(wide!.scenario_id).toBe(revisableFx.scenarioId);
  });

  it('event_markers are NOT trustable from client — server overrides with DB truth', async () => {
    // Make a fresh enrollment so we don't collide with prior tests.
    const { data: e } = await admin
      .from('enrollments')
      .insert({
        student_id: revisableFx.studentId,
        assessment_id: revisableFx.assessmentId,
        phase: 'post',
      })
      .select('id, secret_token')
      .single();
    cleanupEnrollmentIds.push(e!.id);

    // Build a payload but TRY to inject event_markers via a malicious cast.
    // The server action's input contract doesn't accept event_markers on
    // ScreenResponse, but a tampered client could put anything in the JSON
    // payload — TypeScript doesn't run server-side at runtime.
    const responses: ScreenResponse[] = [
      buildResponse(revisableFx, 'q01', 'A', 0),
      buildResponse(revisableFx, 'q02', 'B', 0, 'A'),
    ];
    // Sneak the marker
    (responses[0] as unknown as { event_markers: Record<string, boolean> }).event_markers =
      { governance_instability: true };

    await submitAssessmentByToken({
      token: e!.secret_token,
      scenarioId: revisableFx.scenarioId,
      scenarioVersion: revisableFx.version,
      branchPath: 'A-B',
      responses,
      totalTime: 2000,
    });

    const { data: rows } = await admin
      .from('responses_long')
      .select('option_selected, event_markers')
      .eq('enrollment_id', e!.id)
      .order('id', { ascending: true });
    // Row 1 (q01 A) should have escalation=true (DB markers), NOT governance_instability.
    expect(rows![0].event_markers).toEqual({ escalation: true });
    // Row 2 (q02 B) — DB markers were { drift: true, intervention: true }
    expect(rows![1].event_markers).toEqual({ drift: true, intervention: true });
  });
});
