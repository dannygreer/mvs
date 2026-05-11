'use server';

import {
  insertResponsesLong,
  insertResponsesLongChained,
  insertResponseWide,
  getResponseTagMap,
  getWalkInScenario,
  getScreenOptionMarkers,
  getMcOptionMarkers,
  getScenarioCommitmentMode,
  deleteResponseByParticipant,
} from '@/lib/db';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { ScreenResponse, Phase, McResponse } from '@/types';

export interface SubmitAssessmentData {
  participantId: string;
  firstName: string;
  lastName: string;
  phase: Phase;
  scenarioId: string;
  scenarioVersion: string;
  branchPath: string;
  responses: ScreenResponse[];
  totalTime: number;
  // Day 4 — set when invoked from /app/take/[enrollmentId].
  // Both fields must be present together; the action validates that the
  // enrollment exists, belongs to studentId, and isn't already completed.
  enrollmentId?: string;
  studentId?: string;
}

// Phase 1 Freeze helpers — used by all scenario submission paths to resolve
// "final answer per screen" (revisable mode can have N events per screen).

// Audit fix (subagent MAJOR #1, #2): the scenario submission paths must
// resolve scenarioId/version from the enrollment's bound assessment.scenario_fk
// rather than trust the client. This also lets us validate that every
// optionId in the payload actually belongs to the screen claimed for it —
// closing the marker-tampering vector where a malicious client supplies a
// foreign optionId tagged with markers it wants attributed to its enrollment.
//
// Returns the canonical Scenario row + an (optionId -> screenId) reverse
// lookup. Throws if the enrollment isn't bound to a scenario assessment.
async function loadCanonicalScenarioForEnrollment(
  assessmentId: string,
): Promise<{
  scenarioId: string;
  version: string;
  scenarioDbId: string;
  commitmentMode: 'locked' | 'revisable';
  optionScreenMap: Map<string, string>; // optionId -> screenId
}> {
  const admin = adminClient();
  const { data: a, error: aErr } = await admin
    .from('assessments')
    .select('scenario_fk, kind')
    .eq('id', assessmentId)
    .single();
  if (aErr || !a || !a.scenario_fk) {
    throw new Error('Enrollment is not bound to a scenario assessment');
  }
  if (a.kind !== 'scenario') {
    throw new Error('Enrollment.kind mismatch — not a scenario assessment');
  }
  const { data: s, error: sErr } = await admin
    .from('scenarios')
    .select('id, scenario_id, version, commitment_mode')
    .eq('id', a.scenario_fk)
    .single();
  if (sErr || !s) throw new Error('Enrollment-bound scenario not found');

  // Build optionId -> screenId map by joining screen_options through
  // scenario_screens. One round trip, indexed lookup.
  const { data: screens } = await admin
    .from('scenario_screens')
    .select('id, screen_id, screen_options(id)')
    .eq('scenario_fk', a.scenario_fk);
  const optionScreenMap = new Map<string, string>();
  for (const scr of (screens ?? []) as Array<{
    screen_id: string;
    screen_options: { id: string }[] | null;
  }>) {
    for (const o of scr.screen_options ?? []) {
      optionScreenMap.set(o.id, scr.screen_id);
    }
  }

  return {
    scenarioId: s.scenario_id as string,
    version: s.version as string,
    scenarioDbId: s.id as string,
    commitmentMode:
      ((s.commitment_mode as string) ?? 'locked') as 'locked' | 'revisable',
    optionScreenMap,
  };
}

// Validate every payload response's optionId actually belongs to the screen
// it claims. Timeouts (no optionId) are skipped. Throws on mismatch — same
// philosophy as the MC validator.
function validateScenarioOptionScreens(
  responses: ScreenResponse[],
  optionScreenMap: Map<string, string>,
) {
  for (const r of responses) {
    if (r.timedOut || !r.optionId) continue;
    const expectedScreenId = optionScreenMap.get(r.optionId);
    if (!expectedScreenId) {
      throw new Error(
        `optionId ${r.optionId} does not belong to this scenario`,
      );
    }
    if (expectedScreenId !== r.screenId) {
      throw new Error(
        `optionId ${r.optionId} belongs to screen ${expectedScreenId}, not ${r.screenId}`,
      );
    }
  }
}

function collateFinalAnswersByScreen(
  responses: ScreenResponse[],
): Map<string, { optionLabel: string | null; rtMs: number }> {
  const final = new Map<string, { optionLabel: string | null; rtMs: number }>();
  for (const r of responses) {
    // Overwrite as we go — the last event for a screenId is the final answer.
    final.set(r.screenId, { optionLabel: r.optionLabel, rtMs: r.rtMs });
  }
  return final;
}

function uniqueScreenIdsInOrder(responses: ScreenResponse[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of responses) {
    if (!seen.has(r.screenId)) {
      seen.add(r.screenId);
      out.push(r.screenId);
    }
  }
  return out;
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function submitAssessment(data: SubmitAssessmentData) {
  if (!data.firstName || !data.lastName) throw new Error('Name is required');
  if (data.responses.length === 0) throw new Error('No responses recorded');

  // ---- Day 4: enrollment validation ----
  // The client passes enrollmentId; we DERIVE studentId from the authenticated
  // session (NEVER trust the client-supplied studentId). The action then
  // verifies the enrollment belongs to that session user. Atomic completion
  // happens after inserts (see end of function) to prevent race-replay.
  let authedStudentId: string | null = null;
  // Server-canonical scenario id/version + commitment mode + option->screen
  // map. Computed once below if enrolled, otherwise we fall back to the
  // client-supplied values for the legacy anonymous path.
  let canonicalScenarioId = data.scenarioId;
  let canonicalScenarioVersion = data.scenarioVersion;
  let canonicalScenarioDbId: string | null = null;
  let commitmentMode: 'locked' | 'revisable' =
    (await getScenarioCommitmentMode(data.scenarioId, data.scenarioVersion)) ??
    'locked';
  let optionScreenMap = new Map<string, string>();

  if (data.enrollmentId) {
    const session = await createSessionClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    authedStudentId = user.id;

    const client = adminClient();
    const { data: enrollment, error } = await client
      .from('enrollments')
      .select('id, student_id, completed_at, assessment_id')
      .eq('id', data.enrollmentId)
      .single();
    if (error || !enrollment) throw new Error('Enrollment not found');
    if (enrollment.student_id !== authedStudentId) {
      console.warn(
        `[submitAssessment] enrollment.student_id mismatch on ${data.enrollmentId}`
      );
      throw new Error('Enrollment does not belong to this student');
    }
    if (enrollment.completed_at) {
      throw new Error('ENROLLMENT_ALREADY_COMPLETED');
    }

    // Audit fix: derive canonical scenarioId/version + commitment_mode from
    // the enrollment's bound assessment, NOT from the client payload. Any
    // mismatch in client-supplied scenarioId is logged but the server value
    // wins — the client cannot route around the locked-mode rejection by
    // claiming a different scenario.
    const canonical = await loadCanonicalScenarioForEnrollment(
      enrollment.assessment_id as string,
    );
    if (
      data.scenarioId !== canonical.scenarioId ||
      data.scenarioVersion !== canonical.version
    ) {
      console.warn(
        `[submitAssessment] client scenarioId mismatch: client=${data.scenarioId}/${data.scenarioVersion} server=${canonical.scenarioId}/${canonical.version}; using server value`,
      );
    }
    canonicalScenarioId = canonical.scenarioId;
    canonicalScenarioVersion = canonical.version;
    canonicalScenarioDbId = canonical.scenarioDbId;
    commitmentMode = canonical.commitmentMode;
    optionScreenMap = canonical.optionScreenMap;

    // Validate every optionId belongs to its claimed screen. Blocks the
    // marker-tampering vector where a client supplies a foreign optionId.
    validateScenarioOptionScreens(data.responses, optionScreenMap);
  }

  // Phase 1 Freeze: locked-mode revision rejection.
  const hasRevisions = data.responses.some((r) => r.isRevision || r.revisionNumber > 0);
  if (commitmentMode === 'locked' && hasRevisions) {
    console.error(
      `[submitAssessment] locked-mode revision attempt blocked: scenario=${canonicalScenarioId} enrollment=${data.enrollmentId}`,
    );
    throw new Error('LOCKED_SCENARIO_REVISION_REJECTED');
  }

  // Look up response tags for automatic category assignment. For the
  // enrolled path we use the canonical (enrollment-bound) scenarioDbId; for
  // the anonymous walk-in path we fall back to the walk-in scenario which
  // is hard-bound to active_threat_v1.
  let tagMap: Record<string, string> = {};
  if (canonicalScenarioDbId) {
    tagMap = await getResponseTagMap(canonicalScenarioDbId);
  } else {
    const walkIn = await getWalkInScenario();
    if (walkIn) tagMap = await getResponseTagMap(walkIn.dbId);
  }

  // Look up authoritative per-option markers from screen_options. Never
  // trust client-supplied event_markers — server is the source of truth.
  const optionIds = Array.from(
    new Set(
      data.responses
        .map((r) => r.optionId)
        .filter((id): id is string => typeof id === 'string'),
    ),
  );
  const markerMap = await getScreenOptionMarkers(optionIds);

  // Long format: one row per event (original + revisions in revisable mode).
  const longRows = data.responses.map((r) => ({
    participant_id: data.participantId,
    first_name: data.firstName,
    last_name: data.lastName,
    phase: data.phase,
    scenario_id: canonicalScenarioId,
    scenario_version: canonicalScenarioVersion,
    question_id: r.screenId,
    branch_path: r.branchPath,
    option_selected: r.optionLabel,
    response_category: r.optionLabel
      ? tagMap[`${r.screenId}:${r.optionLabel}`] ?? null
      : null,
    rt_ms: r.rtMs,
    timed_out: r.timedOut,
    enrollment_id: data.enrollmentId ?? null,
    student_id: authedStudentId,
    // Phase 1 Freeze columns.
    event_markers:
      (r.optionId && markerMap.get(r.optionId)) || {},
    presented_options: r.presentedOptions ?? null,
    is_revision: !!r.isRevision,
    revision_number: r.revisionNumber ?? 0,
  }));

  // Chained insert wires revises_response_event_id by previous row id for
  // the same question. Locked mode submissions still go through this path
  // (no revisions in the payload -> no chaining occurs).
  await insertResponsesLongChained(longRows);

  // Wide format: one summary row. In revisable mode the responses array
  // contains multiple events per screen; q1..q6 should reflect the *final
  // committed answer per screen*, not the first event. We walk in order,
  // keeping the last non-revision-or-final answer per screenId.
  const finalAnswers = collateFinalAnswersByScreen(data.responses);
  const orderedScreenIds = uniqueScreenIdsInOrder(data.responses);

  const wideRow = {
    participant_id: data.participantId,
    first_name: data.firstName,
    last_name: data.lastName,
    phase: data.phase,
    scenario_id: canonicalScenarioId,
    scenario_version: canonicalScenarioVersion,
    branch_path: data.branchPath,
    q1_answer: finalAnswers.get(orderedScreenIds[0])?.optionLabel ?? null,
    q1_rt: finalAnswers.get(orderedScreenIds[0])?.rtMs ?? null,
    q2_answer: finalAnswers.get(orderedScreenIds[1])?.optionLabel ?? null,
    q2_rt: finalAnswers.get(orderedScreenIds[1])?.rtMs ?? null,
    q3_answer: finalAnswers.get(orderedScreenIds[2])?.optionLabel ?? null,
    q3_rt: finalAnswers.get(orderedScreenIds[2])?.rtMs ?? null,
    q4_answer: finalAnswers.get(orderedScreenIds[3])?.optionLabel ?? null,
    q4_rt: finalAnswers.get(orderedScreenIds[3])?.rtMs ?? null,
    q5_answer: finalAnswers.get(orderedScreenIds[4])?.optionLabel ?? null,
    q5_rt: finalAnswers.get(orderedScreenIds[4])?.rtMs ?? null,
    q6_answer: finalAnswers.get(orderedScreenIds[5])?.optionLabel ?? null,
    q6_rt: finalAnswers.get(orderedScreenIds[5])?.rtMs ?? null,
    total_time: data.totalTime,
    enrollment_id: data.enrollmentId ?? null,
    student_id: authedStudentId,
    // Phase 1 Freeze: terminal-screen ID for scenarios.
    outcome_state: orderedScreenIds[orderedScreenIds.length - 1] ?? null,
  };

  await insertResponseWide(wideRow);

  // Atomic completion gate. The UPDATE only succeeds when completed_at is
  // still null, so a concurrent second submission gets nothing back and we
  // surface the race as ENROLLMENT_ALREADY_COMPLETED. Trade-off: race losers
  // still inserted their responses_long rows above; v1 tolerates this since
  // the doctrine treats every decision as data and a duplicate set is rare
  // (Day 5 can add a uniqueness constraint on (enrollment_id, question_id)).
  if (data.enrollmentId) {
    const client = adminClient();
    const { data: stamped, error: stampErr } = await client
      .from('enrollments')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', data.enrollmentId)
      .is('completed_at', null)
      .select('id');
    if (stampErr) throw new Error(`Completion stamp failed: ${stampErr.message}`);
    if (!stamped || stamped.length === 0) {
      throw new Error('ENROLLMENT_ALREADY_COMPLETED');
    }
    revalidatePath('/app');
  }
}

export async function deleteAssessmentResult(id: number): Promise<void> {
  await requireSuperAdmin();
  await deleteResponseByParticipant(id);
  revalidatePath('/mvs/admin');
}

// ============================================================
// TOKEN-BASED SUBMISSION (Day 5b — student auth pivot)
// ============================================================
//
// Students don't authenticate. Each enrollment carries a non-guessable
// secret_token; the URL /take/<token> is what the doctor hands out at the
// start of a training session. The token IS the auth — possession of the
// URL proves ownership of that one assessment instance.
//
// These actions are intentionally NOT wrapped in requireSuperAdmin or
// requireStudent. The token verification is the authz gate.

interface TokenLookup {
  id: string;                                  // enrollment id
  student_id: string;
  phase: Phase;
  completed_at: string | null;
  scenario_id: string | null;
  scenario_db_id: string | null;               // scenarios.id
  assessment_code: string;
  assessment_kind: 'scenario' | 'multi_choice';
  assessment_id: string;
  full_name: string | null;
}

async function lookupEnrollmentByToken(token: string): Promise<TokenLookup | null> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('enrollments')
    .select(
      `id, student_id, phase, completed_at,
       assessments(id, code, kind, scenario_fk),
       profiles(full_name)`
    )
    .eq('secret_token', token)
    .single();
  if (error || !data) return null;

  const a = (data as unknown as {
    assessments: {
      id: string;
      code: string;
      kind: 'scenario' | 'multi_choice';
      scenario_fk: string | null;
    } | null;
  }).assessments;
  const p = (data as unknown as {
    profiles: { full_name: string | null } | null;
  }).profiles;

  if (!a) return null;

  return {
    id: data.id as string,
    student_id: data.student_id as string,
    phase: data.phase as Phase,
    completed_at: (data.completed_at as string | null) ?? null,
    assessment_id: a.id,
    assessment_code: a.code,
    assessment_kind: a.kind,
    scenario_db_id: a.scenario_fk,
    scenario_id: a.code,
    full_name: p?.full_name ?? null,
  };
}

export interface SubmitByTokenScenarioData {
  token: string;
  scenarioId: string;
  scenarioVersion: string;
  branchPath: string;
  responses: ScreenResponse[];
  totalTime: number;
}

export async function submitAssessmentByToken(data: SubmitByTokenScenarioData) {
  if (data.responses.length === 0) throw new Error('No responses recorded');
  const enrollment = await lookupEnrollmentByToken(data.token);
  if (!enrollment) throw new Error('Invalid or expired link');
  if (enrollment.completed_at) throw new Error('ENROLLMENT_ALREADY_COMPLETED');
  if (enrollment.assessment_kind !== 'scenario') {
    throw new Error('Token is not for a scenario assessment');
  }

  const fullName = enrollment.full_name ?? '';
  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');
  const participantId = `${(firstName || 'student').toLowerCase()}_${(lastName || 'na').toLowerCase()}_${Date.now()}`;

  // Audit fix: derive canonical scenario from the enrollment's bound
  // assessment, not from the client payload. Same pattern as the auth path.
  if (!enrollment.assessment_id)
    throw new Error('Enrollment missing assessment_id');
  const canonical = await loadCanonicalScenarioForEnrollment(
    enrollment.assessment_id,
  );
  if (
    data.scenarioId !== canonical.scenarioId ||
    data.scenarioVersion !== canonical.version
  ) {
    console.warn(
      `[submitAssessmentByToken] client scenarioId mismatch: client=${data.scenarioId}/${data.scenarioVersion} server=${canonical.scenarioId}/${canonical.version}; using server value`,
    );
  }
  const canonicalScenarioId = canonical.scenarioId;
  const canonicalScenarioVersion = canonical.version;
  const commitmentMode = canonical.commitmentMode;

  // Validate every optionId belongs to its claimed screen.
  validateScenarioOptionScreens(data.responses, canonical.optionScreenMap);

  const hasRevisions = data.responses.some((r) => r.isRevision || r.revisionNumber > 0);
  if (commitmentMode === 'locked' && hasRevisions) {
    console.error(
      `[submitAssessmentByToken] locked-mode revision attempt blocked: scenario=${canonicalScenarioId} token=...${data.token.slice(-6)}`,
    );
    throw new Error('LOCKED_SCENARIO_REVISION_REJECTED');
  }

  // Token path is always enrollment-bound, so use the canonical scenarioDbId.
  let tagMap: Record<string, string> = {};
  tagMap = await getResponseTagMap(canonical.scenarioDbId);

  const optionIds = Array.from(
    new Set(
      data.responses
        .map((r) => r.optionId)
        .filter((id): id is string => typeof id === 'string'),
    ),
  );
  const markerMap = await getScreenOptionMarkers(optionIds);

  const longRows = data.responses.map((r) => ({
    participant_id: participantId,
    first_name: firstName || 'Student',
    last_name: lastName || '',
    phase: enrollment.phase,
    scenario_id: canonicalScenarioId,
    scenario_version: canonicalScenarioVersion,
    question_id: r.screenId,
    branch_path: r.branchPath,
    option_selected: r.optionLabel,
    response_category: r.optionLabel
      ? tagMap[`${r.screenId}:${r.optionLabel}`] ?? null
      : null,
    rt_ms: r.rtMs,
    timed_out: r.timedOut,
    enrollment_id: enrollment.id,
    student_id: enrollment.student_id,
    event_markers: (r.optionId && markerMap.get(r.optionId)) || {},
    presented_options: r.presentedOptions ?? null,
    is_revision: !!r.isRevision,
    revision_number: r.revisionNumber ?? 0,
  }));

  await insertResponsesLongChained(longRows);

  const finalAnswers = collateFinalAnswersByScreen(data.responses);
  const orderedScreenIds = uniqueScreenIdsInOrder(data.responses);

  const wideRow = {
    participant_id: participantId,
    first_name: firstName || 'Student',
    last_name: lastName || '',
    phase: enrollment.phase,
    scenario_id: canonicalScenarioId,
    scenario_version: canonicalScenarioVersion,
    branch_path: data.branchPath,
    q1_answer: finalAnswers.get(orderedScreenIds[0])?.optionLabel ?? null,
    q1_rt: finalAnswers.get(orderedScreenIds[0])?.rtMs ?? null,
    q2_answer: finalAnswers.get(orderedScreenIds[1])?.optionLabel ?? null,
    q2_rt: finalAnswers.get(orderedScreenIds[1])?.rtMs ?? null,
    q3_answer: finalAnswers.get(orderedScreenIds[2])?.optionLabel ?? null,
    q3_rt: finalAnswers.get(orderedScreenIds[2])?.rtMs ?? null,
    q4_answer: finalAnswers.get(orderedScreenIds[3])?.optionLabel ?? null,
    q4_rt: finalAnswers.get(orderedScreenIds[3])?.rtMs ?? null,
    q5_answer: finalAnswers.get(orderedScreenIds[4])?.optionLabel ?? null,
    q5_rt: finalAnswers.get(orderedScreenIds[4])?.rtMs ?? null,
    q6_answer: finalAnswers.get(orderedScreenIds[5])?.optionLabel ?? null,
    q6_rt: finalAnswers.get(orderedScreenIds[5])?.rtMs ?? null,
    total_time: data.totalTime,
    enrollment_id: enrollment.id,
    student_id: enrollment.student_id,
    outcome_state: orderedScreenIds[orderedScreenIds.length - 1] ?? null,
  };
  await insertResponseWide(wideRow);

  const admin = adminClient();
  const { data: stamped } = await admin
    .from('enrollments')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', enrollment.id)
    .is('completed_at', null)
    .select('id');
  if (!stamped || stamped.length === 0) {
    throw new Error('ENROLLMENT_ALREADY_COMPLETED');
  }
}

export interface SubmitByTokenMcData {
  token: string;
  responses: McResponse[];
}

export async function submitMcAssessmentByToken(data: SubmitByTokenMcData) {
  if (data.responses.length === 0) throw new Error('No responses recorded');
  const enrollment = await lookupEnrollmentByToken(data.token);
  if (!enrollment) throw new Error('Invalid or expired link');
  if (enrollment.completed_at) throw new Error('ENROLLMENT_ALREADY_COMPLETED');
  if (enrollment.assessment_kind !== 'multi_choice') {
    throw new Error('Token is not for a multi-choice assessment');
  }

  const admin = adminClient();

  // Validate the supplied option/question combinations against the assessment
  // (same content-integrity check the auth path does).
  const { data: questions } = await admin
    .from('mc_questions')
    .select('id, sequence, mc_options(id, label)')
    .eq('assessment_id', enrollment.assessment_id);
  const optionByQuestion = new Map<
    string,
    { sequence: number; options: Map<string, string> }
  >();
  for (const q of questions ?? []) {
    const optMap = new Map<string, string>();
    const opts =
      (q as unknown as { mc_options: { id: string; label: string }[] })
        .mc_options ?? [];
    for (const o of opts) optMap.set(o.id, o.label);
    optionByQuestion.set(q.id as string, {
      sequence: q.sequence as number,
      options: optMap,
    });
  }
  for (const r of data.responses) {
    const q = optionByQuestion.get(r.questionId);
    if (!q) throw new Error(`Unknown questionId: ${r.questionId}`);
    if (q.sequence !== r.sequence) throw new Error('Sequence mismatch');
    if (r.timedOut) {
      if (r.optionId !== null || r.optionLabel !== null) {
        throw new Error('Timed-out response must have null option');
      }
    } else {
      if (!r.optionId || !r.optionLabel) {
        throw new Error('Non-timed response must have option');
      }
      const label = q.options.get(r.optionId);
      if (!label) throw new Error('optionId does not belong to questionId');
      if (label !== r.optionLabel) throw new Error('optionLabel mismatch');
    }
  }

  const fullName = enrollment.full_name ?? '';
  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');
  const participantId = `${(firstName || 'student').toLowerCase()}_${(lastName || 'na').toLowerCase()}_${Date.now()}`;

  // Phase 1 Freeze: copy authoritative markers from mc_options.
  const mcOptionIds = Array.from(
    new Set(
      data.responses
        .map((r) => r.optionId)
        .filter((id): id is string => typeof id === 'string'),
    ),
  );
  const mcMarkerMap = await getMcOptionMarkers(mcOptionIds);

  const longRows = data.responses.map((r) => ({
    participant_id: participantId,
    first_name: firstName || 'Student',
    last_name: lastName || '',
    phase: enrollment.phase,
    scenario_id: enrollment.assessment_code,
    scenario_version: '1',
    question_id: `q${String(r.sequence).padStart(2, '0')}`,
    branch_path: '',
    option_selected: r.optionLabel,
    response_category: null,
    rt_ms: r.rtMs,
    timed_out: r.timedOut,
    enrollment_id: enrollment.id,
    student_id: enrollment.student_id,
    event_markers: (r.optionId && mcMarkerMap.get(r.optionId)) || {},
    // MC has no presented_options snapshot today — the 4 options are fixed
    // per question. We still write the full set so analytics queries don't
    // need to special-case the column shape.
    presented_options: null,
    is_revision: false,
    revision_number: 0,
  }));

  await insertResponsesLongChained(longRows);

  const { data: stamped } = await admin
    .from('enrollments')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', enrollment.id)
    .is('completed_at', null)
    .select('id');
  if (!stamped || stamped.length === 0) {
    throw new Error('ENROLLMENT_ALREADY_COMPLETED');
  }
}

// ============================================================
// MULTI-CHOICE SUBMISSION (Day 5)
// ============================================================
//
// Same trust model as submitAssessment: studentId is derived from the
// authenticated session, NEVER from the client prop. We accept the prop for
// symmetry with the scenario path but throw if it disagrees with the session.
// We do NOT write a responses_wide row for multi-choice — that table only has
// q1..q6 and we'd have to widen it to 50. Long-format export still pulls
// every MC row from responses_long.

export interface SubmitMcAssessmentData {
  enrollmentId: string;
  studentId: string;            // client-supplied; verified against session
  assessmentCode: string;       // e.g. 'mvs_test_bank_v1'
  phase: Phase;
  participantId: string;
  responses: McResponse[];
}

export async function submitMcAssessment(data: SubmitMcAssessmentData) {
  if (!data.enrollmentId) throw new Error('enrollmentId required');
  if (data.responses.length === 0) throw new Error('No responses recorded');

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  if (user.id !== data.studentId) {
    console.warn(
      `[submitMcAssessment] studentId mismatch: session=${user.id} prop=${data.studentId}`
    );
    throw new Error('Session/student mismatch');
  }

  const admin = adminClient();
  const { data: enrollment, error: eErr } = await admin
    .from('enrollments')
    .select('id, student_id, completed_at, assessment_id')
    .eq('id', data.enrollmentId)
    .single();
  if (eErr || !enrollment) throw new Error('Enrollment not found');
  if (enrollment.student_id !== user.id) {
    console.warn(
      `[submitMcAssessment] enrollment.student_id mismatch on ${data.enrollmentId}`
    );
    throw new Error('Enrollment does not belong to this student');
  }
  if (enrollment.completed_at) {
    throw new Error('ENROLLMENT_ALREADY_COMPLETED');
  }

  // Confirm the enrollment's assessment really is the one the client is
  // submitting against — otherwise a malicious client could submit MC answers
  // against an active-threat enrollment id.
  const { data: assessment } = await admin
    .from('assessments')
    .select('id, code, kind')
    .eq('id', enrollment.assessment_id)
    .single();
  if (!assessment || assessment.code !== data.assessmentCode) {
    throw new Error('Assessment code mismatch with enrollment');
  }
  if (assessment.kind !== 'multi_choice') {
    throw new Error('Enrollment is not a multi-choice assessment');
  }

  // Validate that every supplied (questionId, optionId, optionLabel) actually
  // belongs together — without this a malicious client could submit
  // {questionId: q1, optionId: q47-option-uuid} and poison analytics. We
  // load the full set once and verify each response.
  const { data: questions } = await admin
    .from('mc_questions')
    .select('id, sequence, mc_options(id, label)')
    .eq('assessment_id', enrollment.assessment_id);
  const optionByQuestion = new Map<
    string,
    { sequence: number; options: Map<string, string> }  // optionId -> label
  >();
  for (const q of questions ?? []) {
    const optMap = new Map<string, string>();
    const opts =
      (q as unknown as { mc_options: { id: string; label: string }[] })
        .mc_options ?? [];
    for (const o of opts) optMap.set(o.id, o.label);
    optionByQuestion.set(q.id as string, {
      sequence: q.sequence as number,
      options: optMap,
    });
  }

  for (const r of data.responses) {
    const q = optionByQuestion.get(r.questionId);
    if (!q) throw new Error(`Unknown questionId: ${r.questionId}`);
    if (q.sequence !== r.sequence) {
      throw new Error(`Sequence mismatch for question ${r.questionId}`);
    }
    if (r.timedOut) {
      if (r.optionId !== null || r.optionLabel !== null) {
        throw new Error(`Timed-out response must have null option`);
      }
    } else {
      if (!r.optionId || !r.optionLabel) {
        throw new Error(`Non-timed response must have option`);
      }
      const label = q.options.get(r.optionId);
      if (!label) {
        throw new Error(`optionId does not belong to questionId`);
      }
      if (label !== r.optionLabel) {
        throw new Error(`optionLabel mismatch for ${r.optionId}`);
      }
    }
  }

  // Pull the student's display name once so the long rows are CSV-friendly.
  const { data: profileRow } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();
  const fullName = profileRow?.full_name ?? '';
  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');

  // Phase 1 Freeze: authoritative marker copy from mc_options.
  const mcOptionIds = Array.from(
    new Set(
      data.responses
        .map((r) => r.optionId)
        .filter((id): id is string => typeof id === 'string'),
    ),
  );
  const mcMarkerMap = await getMcOptionMarkers(mcOptionIds);

  const longRows = data.responses.map((r) => ({
    participant_id: data.participantId,
    first_name: firstName || 'Student',
    last_name: lastName || '',
    phase: data.phase,
    scenario_id: data.assessmentCode,         // overloaded: holds assessment.code for MC
    scenario_version: '1',
    question_id: `q${String(r.sequence).padStart(2, '0')}`,
    branch_path: '',
    option_selected: r.optionLabel,
    response_category: null,                  // NEEDS_DOCTOR for MC (#3)
    rt_ms: r.rtMs,
    timed_out: r.timedOut,
    enrollment_id: data.enrollmentId,
    student_id: user.id,
    event_markers: (r.optionId && mcMarkerMap.get(r.optionId)) || {},
    presented_options: null,
    is_revision: false,
    revision_number: 0,
  }));

  await insertResponsesLongChained(longRows);

  // Atomic completion gate (same pattern as scenario path).
  const { data: stamped, error: stampErr } = await admin
    .from('enrollments')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', data.enrollmentId)
    .is('completed_at', null)
    .select('id');
  if (stampErr) throw new Error(`Completion stamp failed: ${stampErr.message}`);
  if (!stamped || stamped.length === 0) {
    throw new Error('ENROLLMENT_ALREADY_COMPLETED');
  }
  revalidatePath('/app');
}
