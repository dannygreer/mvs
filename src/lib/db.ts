import { createClient } from '@supabase/supabase-js';
import { createClient as createSsrClient } from '@/lib/supabase/server';
import type {
  Scenario,
  ScenarioScreen,
  ResponseLongRow,
  ResponseWideRow,
  ResponseTag,
  ScenarioListItem,
} from '@/types';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key);
}

// ============================================================
// SCENARIO LOADING
// ============================================================

async function loadScenarioFromRow(
  client: ReturnType<typeof getClient>,
  scenario: Record<string, unknown>
): Promise<Scenario | null> {
  const { data: screens, error: scrErr } = await client
    .from('scenario_screens')
    .select('*')
    .eq('scenario_fk', scenario.id as string)
    .order('sort_order');

  if (scrErr || !screens || screens.length === 0) return null;

  const screenDbIds = screens.map((s: Record<string, unknown>) => s.id as string);

  const { data: options, error: optErr } = await client
    .from('screen_options')
    .select('*')
    .in('screen_fk', screenDbIds)
    .order('sort_order');

  if (optErr) return null;
  const allOptions = options ?? [];

  const screenMap: Record<string, ScenarioScreen> = {};
  for (const scr of screens) {
    const scrOpts = allOptions
      .filter((o: Record<string, unknown>) => o.screen_fk === scr.id)
      .map((o: Record<string, unknown>) => ({
        id: o.id as string,
        label: o.option_label as string,
        text: o.option_text as string,
        nextScreenId: (o.next_screen_id as string) ?? null,
        // Phase 1 Freeze: triggers_markers JSONB; absent on older rows -> {}
        triggersMarkers:
          (o.triggers_markers as Record<string, boolean> | null) ?? {},
      }));

    screenMap[scr.screen_id as string] = {
      id: scr.screen_id as string,
      dbId: scr.id as string,
      text: (scr.screen_text as string | null) ?? null,
      prompt: (scr.screen_prompt as string) ?? '',
      timerSeconds: scr.timer_seconds as number,
      sortOrder: scr.sort_order as number,
      options: scrOpts,
    };
  }

  return {
    dbId: scenario.id as string,
    scenarioId: scenario.scenario_id as string,
    version: scenario.version as string,
    title: scenario.title as string,
    entryScreenId: scenario.entry_screen_id as string,
    // Phase 1 Freeze fields. commitment_mode defaults to 'locked' in the DB,
    // so any pre-0012 scenario row still resolves to a safe default.
    commitmentMode:
      ((scenario.commitment_mode as string) ?? 'locked') as
        | 'locked'
        | 'revisable',
    classification: {
      domain: (scenario.domain as Scenario['classification']['domain']) ?? null,
      compressionLevel:
        (scenario.compression_level as Scenario['classification']['compressionLevel']) ??
        null,
      ambiguity:
        (scenario.ambiguity as Scenario['classification']['ambiguity']) ?? null,
      emotionalLoad:
        (scenario.emotional_load as Scenario['classification']['emotionalLoad']) ??
        null,
      sensoryComplexity:
        (scenario.sensory_complexity as Scenario['classification']['sensoryComplexity']) ??
        null,
      authorityConflict: (scenario.authority_conflict as boolean | null) ?? null,
      timePressure:
        (scenario.time_pressure as Scenario['classification']['timePressure']) ??
        null,
      casualtyComplexity:
        (scenario.casualty_complexity as Scenario['classification']['casualtyComplexity']) ??
        null,
      governanceChallenge:
        (scenario.governance_challenge as Scenario['classification']['governanceChallenge']) ??
        null,
    },
    screens: screenMap,
    // Day 11 video fields. Both null on text-only scenarios.
    videoUrl: (scenario.video_url as string | null) ?? null,
    videoDurationSeconds:
      (scenario.video_duration_seconds as number | null) ?? null,
    // Day 11.5 scenario-level setup text. Recognition-test scenarios
    // populate this; active-threat leaves it null and keeps per-screen text.
    setupText: (scenario.setup_text as string | null) ?? null,
  } as Scenario;
}

export async function getScenarioById(id: string): Promise<Scenario | null> {
  const client = getClient();
  const { data, error } = await client
    .from('scenarios')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return loadScenarioFromRow(client, data as Record<string, unknown>);
}

// Walk-in scenario for the anonymous `/quiz` path. Hard-bound to
// `active_threat_v1` by scenario_id: adding more scenarios to the DB (with
// `is_active=true` toggled on any of them) MUST NOT swap the walk-in
// experience out from under anonymous users. The walk-in is the doctrine
// baseline; everything else is an enrollment-bound assessment behind auth
// or a token URL.
// Day 13: load a scenario by its public code (scenarios.scenario_id). When
// multiple versions exist, returns the highest. Used by the Phase 1 / 2
// admin pages to look up active_threat_v1 without hardcoding a uuid.
export async function getScenarioByCode(
  scenarioCode: string,
): Promise<Scenario | null> {
  const client = getClient();
  const { data, error } = await client
    .from('scenarios')
    .select('*')
    .eq('scenario_id', scenarioCode)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return loadScenarioFromRow(client, data as Record<string, unknown>);
}

export async function getWalkInScenario(): Promise<Scenario | null> {
  const client = getClient();
  const { data, error } = await client
    .from('scenarios')
    .select('*')
    .eq('scenario_id', 'active_threat_v1')
    .order('version', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return loadScenarioFromRow(client, data as Record<string, unknown>);
}

// Admin-side "default" scenario: whichever scenario the super_admin toggled
// is_active=true for. Used as the initial load for the Scenario Builder tab.
// The admin UI has a selector to switch among all scenarios.
export async function getDefaultAdminScenario(): Promise<Scenario | null> {
  const client = getClient();
  const { data, error } = await client
    .from('scenarios')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (error || !data) return null;
  return loadScenarioFromRow(client, data as Record<string, unknown>);
}

// Load a scenario by the assessment_id that an enrollment binds to. Used
// from the authenticated `/app/take/[enrollmentId]` path and from server
// actions that need the canonical scenario for a given enrollment.
export async function getScenarioByAssessmentId(
  assessmentId: string,
): Promise<Scenario | null> {
  const client = getClient();
  const { data: a } = await client
    .from('assessments')
    .select('scenario_fk')
    .eq('id', assessmentId)
    .single();
  if (!a || !a.scenario_fk) return null;
  return getScenarioById(a.scenario_fk as string);
}

// ============================================================
// MULTI-CHOICE (Day 5)
// ============================================================
//
// CRITICAL: loadMcQuestionsForStudent must NEVER select is_correct or
// response_category. Both columns are present on mc_options for super_admin
// authoring + scoring, but exposing them to the student client would leak
// the answer key. The RLS policy "authenticated read mc_options" allows
// reads (we depend on it for the student runner), so the application layer
// is the gate. tests/rls.spec.ts asserts this loader's projection.

import type { McQuestion } from '@/types';

// Day 11: admin-facing MC question loader. Unlike loadMcQuestionsForStudent
// (which deliberately omits the answer key), this returns is_correct +
// triggers_markers so the admin marker editor can render the 8-checkbox grid
// per option and the answer key for context. Server-only; the result must
// never be passed verbatim to a student client.
//
// Defense-in-depth note: the page route that calls this is already behind
// requireSuperAdmin() (via proxy.ts and the /mvs/admin layout), so this
// loader doesn't re-check. Do NOT import this from a non-admin route.
export interface McAdminQuestion {
  id: string;
  sequence: number;
  prompt: string;
  options: {
    id: string;
    label: 'A' | 'B' | 'C' | 'D';
    text: string;
    isCorrect: boolean;
    triggersMarkers: Record<string, boolean>;
  }[];
}

export async function loadMcQuestionsForAdmin(
  assessmentId: string,
): Promise<McAdminQuestion[]> {
  const client = getClient();
  const { data: questions, error: qErr } = await client
    .from('mc_questions')
    .select('id, sequence, prompt')
    .eq('assessment_id', assessmentId)
    .order('sequence');
  if (qErr) throw new Error(qErr.message);
  if (!questions || questions.length === 0) return [];

  const qIds = questions.map((q) => q.id as string);
  const { data: options, error: oErr } = await client
    .from('mc_options')
    .select('id, question_id, label, text, is_correct, triggers_markers')
    .in('question_id', qIds)
    .order('label');
  if (oErr) throw new Error(oErr.message);

  const byQuestion = new Map<string, McAdminQuestion['options']>();
  for (const o of options ?? []) {
    const arr = byQuestion.get(o.question_id as string) ?? [];
    arr.push({
      id: o.id as string,
      label: o.label as 'A' | 'B' | 'C' | 'D',
      text: o.text as string,
      isCorrect: !!o.is_correct,
      triggersMarkers:
        (o.triggers_markers as Record<string, boolean> | null) ?? {},
    });
    byQuestion.set(o.question_id as string, arr);
  }

  return questions.map((q) => ({
    id: q.id as string,
    sequence: q.sequence as number,
    prompt: q.prompt as string,
    options: byQuestion.get(q.id as string) ?? [],
  }));
}

// List MC assessments for the admin tab picker. Returns one row per
// kind='multi_choice' assessment.
export interface McAdminAssessment {
  id: string;
  code: string;
  name: string;
}
export async function listMcAssessments(): Promise<McAdminAssessment[]> {
  const { data, error } = await getClient()
    .from('assessments')
    .select('id, code, name')
    .eq('kind', 'multi_choice')
    .order('code');
  if (error) throw new Error(error.message);
  return (data ?? []) as McAdminAssessment[];
}

// Phase 3 admin lens: load any subset of assessments by their public codes,
// preserving the input order so the sub-tab strip renders in doctrine order
// (test bank first, then 5 video scenarios). Returns scenario_fk as well so
// the caller can hand the right scenario to ScenarioBuilderTab without a
// second round-trip.
export interface PhaseAssessmentRow {
  id: string;
  code: string;
  name: string;
  kind: 'scenario' | 'multi_choice';
  scenario_fk: string | null;
}
export async function listAssessmentsByCodes(
  codes: string[],
): Promise<PhaseAssessmentRow[]> {
  if (codes.length === 0) return [];
  const { data, error } = await getClient()
    .from('assessments')
    .select('id, code, name, kind, scenario_fk')
    .in('code', codes);
  if (error) throw new Error(error.message);
  const byCode = new Map<string, PhaseAssessmentRow>();
  for (const r of (data ?? []) as PhaseAssessmentRow[]) byCode.set(r.code, r);
  return codes
    .map((c) => byCode.get(c))
    .filter((r): r is PhaseAssessmentRow => r != null);
}

export async function loadMcQuestionsForStudent(
  assessmentId: string
): Promise<McQuestion[]> {
  const client = getClient();
  const { data: questions, error: qErr } = await client
    .from('mc_questions')
    .select('id, sequence, prompt, time_limit_seconds')
    .eq('assessment_id', assessmentId)
    .order('sequence');
  if (qErr) throw new Error(qErr.message);
  if (!questions || questions.length === 0) return [];

  const qIds = questions.map((q) => q.id as string);
  const { data: options, error: oErr } = await client
    .from('mc_options')
    .select('id, question_id, label, text')
    .in('question_id', qIds)
    .order('label');
  if (oErr) throw new Error(oErr.message);

  const byQuestion = new Map<string, McQuestion['options']>();
  for (const o of options ?? []) {
    const arr = byQuestion.get(o.question_id as string) ?? [];
    arr.push({
      id: o.id as string,
      label: o.label as 'A' | 'B' | 'C' | 'D',
      text: o.text as string,
    });
    byQuestion.set(o.question_id as string, arr);
  }

  return questions.map((q) => ({
    id: q.id as string,
    sequence: q.sequence as number,
    prompt: q.prompt as string,
    timeLimitSeconds: (q.time_limit_seconds as number | null) ?? null,
    options: byQuestion.get(q.id as string) ?? [],
  }));
}

// ============================================================
// RESPONSE SUBMISSION
// ============================================================

export async function insertResponsesLong(
  rows: Omit<ResponseLongRow, 'id' | 'timestamp'>[],
) {
  const { error } = await getClient().from('responses_long').insert(rows);
  if (error) throw new Error(error.message);
}

// Phase 1 Freeze: insert revisable-mode events in order, chaining
// revises_response_event_id to the prior row's id for the same question.
// Returns the inserted row ids in order (caller can correlate to its input).
//
// Why one-at-a-time: we need the postgres-assigned id of row N to write into
// row N+1's revises_response_event_id. A batched insert with a single RETURNING
// would yield ids but we'd still need a second UPDATE pass to wire chains. One
// pass of N inserts is simpler and 6-12 rows per submission is well within
// budget for the rare scenario flow.
export async function insertResponsesLongChained(
  rows: (Omit<ResponseLongRow, 'id' | 'timestamp'> & {
    is_revision: boolean;
    revision_number: number;
    event_markers: Record<string, boolean>;
    presented_options: { id: string; label: string; text: string }[] | null;
  })[],
): Promise<number[]> {
  const client = getClient();
  // Track most recent inserted id per (enrollment_id|null, question_id).
  // A revision_number > 0 row inherits revises_response_event_id from the
  // last-seen id for the same key.
  const lastIdByQuestion = new Map<string, number>();
  const insertedIds: number[] = [];

  for (const row of rows) {
    const key = `${row.enrollment_id ?? ''}::${row.question_id}`;
    const revisesId =
      row.is_revision && lastIdByQuestion.has(key)
        ? lastIdByQuestion.get(key)!
        : null;
    const { data, error } = await client
      .from('responses_long')
      .insert({ ...row, revises_response_event_id: revisesId })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    const id = data!.id as number;
    insertedIds.push(id);
    lastIdByQuestion.set(key, id);
  }
  return insertedIds;
}

// Per-option marker lookup used by server actions to copy authoritative
// triggers_markers JSONB at submit time. Untrusted client payload is the
// reason we don't accept event_markers directly from the client.
export async function getScreenOptionMarkers(
  optionIds: string[],
): Promise<Map<string, Record<string, boolean>>> {
  if (optionIds.length === 0) return new Map();
  const { data, error } = await getClient()
    .from('screen_options')
    .select('id, triggers_markers')
    .in('id', optionIds);
  if (error) throw new Error(error.message);
  const map = new Map<string, Record<string, boolean>>();
  for (const r of data ?? []) {
    map.set(
      r.id as string,
      (r.triggers_markers as Record<string, boolean> | null) ?? {},
    );
  }
  return map;
}

export async function getMcOptionMarkers(
  optionIds: string[],
): Promise<Map<string, Record<string, boolean>>> {
  if (optionIds.length === 0) return new Map();
  const { data, error } = await getClient()
    .from('mc_options')
    .select('id, triggers_markers')
    .in('id', optionIds);
  if (error) throw new Error(error.message);
  const map = new Map<string, Record<string, boolean>>();
  for (const r of data ?? []) {
    map.set(
      r.id as string,
      (r.triggers_markers as Record<string, boolean> | null) ?? {},
    );
  }
  return map;
}

// Look up a scenario's commitment_mode at submit time. We re-read this from
// the DB rather than trusting whatever the client sent so a tampered client
// can't bypass the locked-mode rejection guard.
export async function getScenarioCommitmentMode(
  scenarioId: string,
  version: string,
): Promise<'locked' | 'revisable' | null> {
  const { data, error } = await getClient()
    .from('scenarios')
    .select('commitment_mode')
    .eq('scenario_id', scenarioId)
    .eq('version', version)
    .single();
  if (error || !data) return null;
  return (data.commitment_mode as 'locked' | 'revisable') ?? 'locked';
}

// Phase 1 Freeze admin: update commitment_mode + 9 classification tags on a
// scenario row. Any subset of fields can be passed; undefined values are
// ignored so partial-form saves work.
export interface ScenarioMetaPatch {
  commitment_mode?: 'locked' | 'revisable';
  domain?: 'tactical' | 'medical' | 'leadership' | 'executive' | null;
  compression_level?: 'low' | 'moderate' | 'high' | 'extreme' | null;
  ambiguity?: 'low' | 'moderate' | 'high' | null;
  emotional_load?: 'low' | 'moderate' | 'high' | null;
  sensory_complexity?: 'low' | 'moderate' | 'high' | null;
  authority_conflict?: boolean | null;
  time_pressure?: 'low' | 'moderate' | 'high' | null;
  casualty_complexity?: 'none' | 'single' | 'multiple' | 'mass' | null;
  governance_challenge?: 'individual' | 'team' | 'organizational' | null;
}

export async function updateScenarioMeta(
  scenarioFk: string,
  patch: ScenarioMetaPatch,
) {
  // Drop undefined to avoid clobbering existing values.
  const cleaned = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(cleaned).length === 0) return;
  const { error } = await getClient()
    .from('scenarios')
    .update(cleaned)
    .eq('id', scenarioFk);
  if (error) throw new Error(error.message);
}

// Day 11.5: scenario-level setup_text (recognition-test scenarios only).
export async function updateScenarioSetupText(
  scenarioFk: string,
  setupText: string | null,
) {
  const { error } = await getClient()
    .from('scenarios')
    .update({ setup_text: setupText })
    .eq('id', scenarioFk);
  if (error) throw new Error(error.message);
}

// Day 11 video metadata — set both or null both. The DB-level constraint
// `video_url_requires_duration` enforces this; the caller (admin action)
// is expected to validate before calling.
export async function updateScenarioVideo(
  scenarioFk: string,
  videoUrl: string | null,
  durationSeconds: number | null,
) {
  const { error } = await getClient()
    .from('scenarios')
    .update({
      video_url: videoUrl,
      video_duration_seconds: durationSeconds,
    })
    .eq('id', scenarioFk);
  if (error) throw new Error(error.message);
}

// Phase 1 Freeze admin: update triggers_markers JSONB on a screen_options
// row. Caller supplies the full 8-marker object (or a partial — keys are
// merged at the column level, not overwritten wholesale).
export async function updateScreenOptionMarkers(
  optionDbId: string,
  markers: Record<string, boolean>,
) {
  const { error } = await getClient()
    .from('screen_options')
    .update({ triggers_markers: markers })
    .eq('id', optionDbId);
  if (error) throw new Error(error.message);
}

export async function updateMcOptionMarkers(
  optionDbId: string,
  markers: Record<string, boolean>,
) {
  const { error } = await getClient()
    .from('mc_options')
    .update({ triggers_markers: markers })
    .eq('id', optionDbId);
  if (error) throw new Error(error.message);
}

export async function insertResponseWide(
  row: Omit<ResponseWideRow, 'id' | 'completed_at'>,
) {
  const { error } = await getClient().from('responses_wide').insert(row);
  if (error) throw new Error(error.message);
}

// ============================================================
// RESPONSE QUERIES
// ============================================================

export async function getAllResponsesWide(): Promise<ResponseWideRow[]> {
  const { data, error } = await getClient()
    .from('responses_wide')
    .select('*')
    .order('completed_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResponseWideRow[];
}

// Count-only variant of getResponsesByCodes. Used by phase pages to
// populate the Responses sub-tab badge without paying for the full row
// payload when the user is in editor view.
export async function countResponsesByCodes(
  codes: string[],
  phase: 'pre' | 'post' | 'practice' | null,
): Promise<number> {
  if (codes.length === 0) return 0;
  let q = getClient()
    .from('responses_wide')
    .select('id', { count: 'exact', head: true })
    .in('scenario_id', codes);
  if (phase) q = q.eq('phase', phase);
  const { count } = await q;
  return count ?? 0;
}

// Phase-scoped slice of responses_wide. Used by the per-phase Responses
// sub-tab on the admin pages. `codes` is matched against scenario_id (which
// stores the assessment code), and `phase` filters enrollments.phase
// (pre / post / practice). Pass phase=null to keep all phases.
export async function getResponsesByCodes(
  codes: string[],
  phase: 'pre' | 'post' | 'practice' | null,
): Promise<ResponseWideRow[]> {
  if (codes.length === 0) return [];
  let q = getClient()
    .from('responses_wide')
    .select('*')
    .in('scenario_id', codes)
    .order('completed_at', { ascending: false });
  if (phase) q = q.eq('phase', phase);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ResponseWideRow[];
}

export async function getAllResponsesLong(): Promise<ResponseLongRow[]> {
  const { data, error } = await getClient()
    .from('responses_long')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResponseLongRow[];
}

export async function deleteResponseByParticipant(wideId: number): Promise<void> {
  const client = getClient();

  const { data: row } = await client
    .from('responses_wide')
    .select('participant_id')
    .eq('id', wideId)
    .single();

  if (row) {
    await client
      .from('responses_long')
      .delete()
      .eq('participant_id', row.participant_id);
  }

  const { error } = await client
    .from('responses_wide')
    .delete()
    .eq('id', wideId);
  if (error) throw new Error(error.message);
}

// ============================================================
// RESPONSE TAGS
// ============================================================

export async function getResponseTags(scenarioFk: string): Promise<ResponseTag[]> {
  const { data, error } = await getClient()
    .from('response_tags')
    .select('*')
    .eq('scenario_fk', scenarioFk);
  if (error) throw new Error(error.message);
  return (data ?? []) as ResponseTag[];
}

export async function getResponseTagMap(
  scenarioFk: string,
): Promise<Record<string, string>> {
  const tags = await getResponseTags(scenarioFk);
  const map: Record<string, string> = {};
  for (const t of tags) {
    map[`${t.screen_id}:${t.option_label}`] = t.response_category;
  }
  return map;
}

export async function upsertResponseTag(tag: {
  scenario_fk: string;
  screen_id: string;
  option_label: string;
  response_category: string;
}): Promise<void> {
  const { error } = await getClient()
    .from('response_tags')
    .upsert(tag, { onConflict: 'scenario_fk,screen_id,option_label' });
  if (error) throw new Error(error.message);
}

export async function deleteResponseTag(
  scenarioFk: string,
  screenId: string,
  optionLabel: string,
): Promise<void> {
  const { error } = await getClient()
    .from('response_tags')
    .delete()
    .eq('scenario_fk', scenarioFk)
    .eq('screen_id', screenId)
    .eq('option_label', optionLabel);
  if (error) throw new Error(error.message);
}

// ============================================================
// SCENARIO MANAGEMENT (Admin)
// ============================================================

export async function getAllScenarios(): Promise<ScenarioListItem[]> {
  const { data, error } = await getClient()
    .from('scenarios')
    .select('id, scenario_id, version, title, is_active')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ScenarioListItem[];
}

export async function setActiveScenario(id: string): Promise<void> {
  const client = getClient();
  await client.from('scenarios').update({ is_active: false }).neq('id', '');
  const { error } = await client
    .from('scenarios')
    .update({ is_active: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateScreenText(
  screenDbId: string,
  text: string,
): Promise<void> {
  const { error } = await getClient()
    .from('scenario_screens')
    .update({ screen_text: text })
    .eq('id', screenDbId);
  if (error) throw new Error(error.message);
}

export async function updateScreenTimer(
  screenDbId: string,
  seconds: number,
): Promise<void> {
  const { error } = await getClient()
    .from('scenario_screens')
    .update({ timer_seconds: seconds })
    .eq('id', screenDbId);
  if (error) throw new Error(error.message);
}

export async function updateOptionText(
  optionDbId: string,
  text: string,
): Promise<void> {
  const { error } = await getClient()
    .from('screen_options')
    .update({ option_text: text })
    .eq('id', optionDbId);
  if (error) throw new Error(error.message);
}

export async function updateOptionRoute(
  optionDbId: string,
  nextScreenId: string | null,
): Promise<void> {
  const { error } = await getClient()
    .from('screen_options')
    .update({ next_screen_id: nextScreenId })
    .eq('id', optionDbId);
  if (error) throw new Error(error.message);
}

export async function updateScreenPrompt(
  screenDbId: string,
  prompt: string,
): Promise<void> {
  const { error } = await getClient()
    .from('scenario_screens')
    .update({ screen_prompt: prompt })
    .eq('id', screenDbId);
  if (error) throw new Error(error.message);
}

export async function addScreen(
  scenarioFk: string,
  screenId: string,
  text: string,
  timerSeconds: number,
  sortOrder: number,
): Promise<string> {
  const { data, error } = await getClient()
    .from('scenario_screens')
    .insert({
      scenario_fk: scenarioFk,
      screen_id: screenId,
      screen_text: text,
      timer_seconds: timerSeconds,
      sort_order: sortOrder,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function addOption(
  screenFk: string,
  label: string,
  text: string,
  nextScreenId: string | null,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient()
    .from('screen_options')
    .insert({
      screen_fk: screenFk,
      option_label: label,
      option_text: text,
      next_screen_id: nextScreenId,
      sort_order: sortOrder,
    });
  if (error) throw new Error(error.message);
}

export async function deleteScreen(screenDbId: string): Promise<void> {
  const { error } = await getClient()
    .from('scenario_screens')
    .delete()
    .eq('id', screenDbId);
  if (error) throw new Error(error.message);
}

export async function deleteOption(optionDbId: string): Promise<void> {
  const { error } = await getClient()
    .from('screen_options')
    .delete()
    .eq('id', optionDbId);
  if (error) throw new Error(error.message);
}

// ============================================================
// LEGACY — existing quiz_results (preserved, not extended)
// ============================================================

export interface QuizResultRow {
  id: number;
  first_name: string;
  last_name: string;
  answer_1: number;
  answer_2: number;
  answer_3: number;
  time_1_ms: number;
  time_2_ms: number;
  time_3_ms: number;
  total_time_ms: number;
  completed_at: string;
}

export async function getAllResults(): Promise<QuizResultRow[]> {
  const { data, error } = await getClient()
    .from('quiz_results')
    .select('*')
    .order('completed_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as QuizResultRow[];
}

export async function deleteResult(id: number): Promise<void> {
  const { error } = await getClient()
    .from('quiz_results')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ============================================================
// ORGS (Day 3)
// ============================================================
//
// IMPORTANT: every helper below uses the service-role client and therefore
// bypasses RLS entirely. Callers MUST enforce authorization themselves
// (currently `requireSuperAdmin()` at every consumer page / server action).
// Do NOT call these from user-scoped routes without an explicit role check.

export type OrgRow = {
  id: string;
  name: string;
  type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: 'lead' | 'active' | 'completed' | 'churned';
  deal_value_cents: number | null;
  notes: string | null;
  // ISO date string (YYYY-MM-DD) or null. Migration 0016.
  session_date: string | null;
  created_at: string;
  updated_at: string;
};

export type OrgListItem = OrgRow & { student_count: number };

export type OrgRosterRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: 'super_admin' | 'org_admin' | 'student';
  created_at: string;
  completed_count: number;
  // Day 5b: per-enrollment take-URL tokens, paired with their phase + status.
  enrollments: {
    id: string;
    phase: 'pre' | 'post' | 'practice';
    secret_token: string;
    completed_at: string | null;
    assessment_code: string;
    assessment_name: string;
  }[];
};

export type OrgInput = {
  name: string;
  type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: 'lead' | 'active' | 'completed' | 'churned';
  deal_value_cents: number | null;
  notes: string | null;
  session_date: string | null;
};

export async function listOrgs(): Promise<OrgListItem[]> {
  const client = getClient();
  const { data: orgs, error } = await client
    .from('orgs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const { data: profiles } = await client
    .from('profiles')
    .select('org_id')
    .not('org_id', 'is', null);

  const counts = new Map<string, number>();
  for (const p of profiles ?? []) {
    if (!p.org_id) continue;
    counts.set(p.org_id, (counts.get(p.org_id) ?? 0) + 1);
  }
  return (orgs ?? []).map((o) => ({
    ...o,
    student_count: counts.get(o.id) ?? 0,
  })) as OrgListItem[];
}

export async function getOrg(id: string): Promise<OrgRow | null> {
  const { data, error } = await getClient()
    .from('orgs')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as OrgRow;
}

export async function insertOrg(input: OrgInput): Promise<OrgRow> {
  const { data, error } = await getClient()
    .from('orgs')
    .insert(input)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as OrgRow;
}

export async function updateOrgRow(id: string, input: Partial<OrgInput>): Promise<void> {
  const { error } = await getClient().from('orgs').update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getOrgRoster(orgId: string): Promise<OrgRosterRow[]> {
  const client = getClient();
  const { data: profiles, error } = await client
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!profiles || profiles.length === 0) return [];

  // Email comes from auth.users — fetch the page that contains our profile ids.
  // For v1 we paginate through up to 1000 users (worst case 20 pages of 50).
  // Day 4+ should switch to a SQL RPC or a materialized email column.
  const ids = new Set(profiles.map((p) => p.id));
  const emailById = new Map<string, string | null>();
  let page = 1;
  while (emailById.size < ids.size && page <= 20) {
    const { data: list } = await client.auth.admin.listUsers({ page, perPage: 50 });
    if (!list || list.users.length === 0) break;
    for (const u of list.users) {
      if (ids.has(u.id)) emailById.set(u.id, u.email ?? null);
    }
    if (list.users.length < 50) break;
    page++;
  }

  const { data: enrollments } = await client
    .from('enrollments')
    .select(
      'id, student_id, phase, secret_token, completed_at, assessments(code, name)'
    )
    .in('student_id', Array.from(ids));
  const completedById = new Map<string, number>();
  const enrollmentsById = new Map<string, OrgRosterRow['enrollments']>();
  for (const e of enrollments ?? []) {
    if (e.completed_at) {
      completedById.set(
        e.student_id,
        (completedById.get(e.student_id) ?? 0) + 1
      );
    }
    const arr = enrollmentsById.get(e.student_id) ?? [];
    const joined = (e as unknown as {
      assessments: { code: string; name: string } | null;
    }).assessments;
    arr.push({
      id: e.id as string,
      phase: e.phase as 'pre' | 'post' | 'practice',
      secret_token: e.secret_token as string,
      completed_at: (e.completed_at as string | null) ?? null,
      assessment_code: joined?.code ?? '',
      assessment_name: joined?.name ?? joined?.code ?? '',
    });
    enrollmentsById.set(e.student_id, arr);
  }

  return profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailById.get(p.id) ?? null,
    role: p.role as OrgRosterRow['role'],
    created_at: p.created_at,
    completed_count: completedById.get(p.id) ?? 0,
    enrollments: enrollmentsById.get(p.id) ?? [],
  }));
}

// ============================================================
// ENROLLMENT SCORES (Day 6 — used by both super_admin + org_admin)
// ============================================================
//
// These two helpers query the security_invoker views from migration 0010.
// They use an AUTHENTICATED supabase client (not service role) so RLS
// applies — org_admins automatically get scoped to their own org's rows.

export type EnrollmentScoreRow = {
  enrollment_id: string;
  student_id: string;
  org_id: string | null;
  assessment_id: string;
  assessment_code: string;
  assessment_kind: 'scenario' | 'multi_choice';
  phase: 'pre' | 'post' | 'practice';
  assigned_at: string;
  completed_at: string | null;
  response_count: number;
  timed_out_count: number;
  total_time_ms: number;
  avg_rt_ms: number | null;
  correct_count: number | null;
  total_questions: number | null;
  score_percent: number | null;
  pass: boolean | null;
};

export async function listEnrollmentScoresForCurrentOrg(): Promise<EnrollmentScoreRow[]> {
  const ssr = await createSsrClient();
  const { data, error } = await ssr
    .from('enrollment_scores')
    .select('*')
    .order('completed_at', { ascending: false, nullsFirst: true })
    .order('assigned_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EnrollmentScoreRow[];
}

export type OrgRollupRow = {
  org_id: string;
  assessment_id: string;
  assessment_code: string;
  assessment_kind: 'scenario' | 'multi_choice';
  phase: 'pre' | 'post' | 'practice';
  enrolled_count: number;
  completed_count: number;
  passed_count: number;
  avg_score_percent: number | null;
  avg_total_time_ms: number | null;
  avg_rt_ms: number | null;
};

export async function listOrgRollupForCurrentOrg(): Promise<OrgRollupRow[]> {
  const ssr = await createSsrClient();
  const { data, error } = await ssr
    .from('org_assessment_rollup')
    .select('*')
    .order('assessment_code')
    .order('phase');
  if (error) throw new Error(error.message);
  return (data ?? []) as OrgRollupRow[];
}

// ============================================================
// ORG ADMIN listing — Day 6
// ============================================================
//
// Same authz caveat as the rest of this module: service-role bypasses RLS,
// callers must enforce role themselves.

export type OrgAdminRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

export async function getOrgAdmins(orgId: string): Promise<OrgAdminRow[]> {
  const client = getClient();
  const { data: profiles, error } = await client
    .from('profiles')
    .select('id, full_name, created_at')
    .eq('org_id', orgId)
    .eq('role', 'org_admin')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!profiles || profiles.length === 0) return [];

  // Email comes from auth.users (paginated lookup, bounded).
  const ids = new Set(profiles.map((p) => p.id));
  const emailById = new Map<string, string | null>();
  let page = 1;
  while (emailById.size < ids.size && page <= 20) {
    const { data: list } = await client.auth.admin.listUsers({ page, perPage: 50 });
    if (!list || list.users.length === 0) break;
    for (const u of list.users) {
      if (ids.has(u.id)) emailById.set(u.id, u.email ?? null);
    }
    if (list.users.length < 50) break;
    page++;
  }

  return profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailById.get(p.id) ?? null,
    created_at: p.created_at,
  }));
}
