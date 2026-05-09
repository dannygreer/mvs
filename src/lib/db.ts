import { createClient } from '@supabase/supabase-js';
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
      }));

    screenMap[scr.screen_id as string] = {
      id: scr.screen_id as string,
      dbId: scr.id as string,
      text: scr.screen_text as string,
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
    screens: screenMap,
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

export async function getActiveScenario(): Promise<Scenario | null> {
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

// ============================================================
// RESPONSE SUBMISSION
// ============================================================

export async function insertResponsesLong(
  rows: Omit<ResponseLongRow, 'id' | 'timestamp'>[],
) {
  const { error } = await getClient().from('responses_long').insert(rows);
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
};

export type OrgInput = {
  name: string;
  type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: 'lead' | 'active' | 'completed' | 'churned';
  deal_value_cents: number | null;
  notes: string | null;
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
    .select('student_id, completed_at')
    .in('student_id', Array.from(ids));
  const completedById = new Map<string, number>();
  for (const e of enrollments ?? []) {
    if (e.completed_at) {
      completedById.set(
        e.student_id,
        (completedById.get(e.student_id) ?? 0) + 1
      );
    }
  }

  return profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailById.get(p.id) ?? null,
    role: p.role as OrgRosterRow['role'],
    created_at: p.created_at,
    completed_count: completedById.get(p.id) ?? 0,
  }));
}
