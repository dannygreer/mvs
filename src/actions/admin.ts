'use server';

import { requireSuperAdmin } from '@/lib/auth';
import {
  setActiveScenario,
  updateScreenText,
  updateScreenTimer,
  updateScreenPrompt,
  updateOptionText,
  updateOptionRoute,
  addScreen,
  addOption,
  deleteScreen,
  deleteOption,
  upsertResponseTag,
  deleteResponseTag,
  updateScenarioMeta,
  updateScenarioSetupText,
  updateScreenOptionMarkers,
  updateMcOptionMarkers,
  type ScenarioMetaPatch,
} from '@/lib/db';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
  await requireSuperAdmin();
}

export async function adminSetActiveScenario(id: string) {
  await requireAdmin();
  await setActiveScenario(id);
  revalidatePath('/mvs/admin');
}

export async function adminUpdateScreenText(screenDbId: string, text: string) {
  await requireAdmin();
  await updateScreenText(screenDbId, text);
  revalidatePath('/mvs/admin');
}

export async function adminUpdateScreenPrompt(screenDbId: string, prompt: string) {
  await requireAdmin();
  await updateScreenPrompt(screenDbId, prompt);
  revalidatePath('/mvs/admin');
}

export async function adminUpdateScreenTimer(screenDbId: string, seconds: number) {
  await requireAdmin();
  await updateScreenTimer(screenDbId, seconds);
  revalidatePath('/mvs/admin');
}

export async function adminUpdateOptionText(optionDbId: string, text: string) {
  await requireAdmin();
  await updateOptionText(optionDbId, text);
  revalidatePath('/mvs/admin');
}

export async function adminUpdateOptionRoute(optionDbId: string, nextScreenId: string | null) {
  await requireAdmin();
  await updateOptionRoute(optionDbId, nextScreenId);
  revalidatePath('/mvs/admin');
}

export async function adminAddScreen(
  scenarioFk: string,
  screenId: string,
  text: string,
  timerSeconds: number,
  sortOrder: number,
) {
  await requireAdmin();
  await addScreen(scenarioFk, screenId, text, timerSeconds, sortOrder);
  revalidatePath('/mvs/admin');
}

export async function adminAddOption(
  screenFk: string,
  label: string,
  text: string,
  nextScreenId: string | null,
  sortOrder: number,
) {
  await requireAdmin();
  await addOption(screenFk, label, text, nextScreenId, sortOrder);
  revalidatePath('/mvs/admin');
}

export async function adminDeleteScreen(screenDbId: string) {
  await requireAdmin();
  await deleteScreen(screenDbId);
  revalidatePath('/mvs/admin');
}

export async function adminDeleteOption(optionDbId: string) {
  await requireAdmin();
  await deleteOption(optionDbId);
  revalidatePath('/mvs/admin');
}

export async function adminUpsertResponseTag(
  scenarioFk: string,
  screenId: string,
  optionLabel: string,
  category: string,
) {
  await requireAdmin();
  await upsertResponseTag({
    scenario_fk: scenarioFk,
    screen_id: screenId,
    option_label: optionLabel,
    response_category: category,
  });
  revalidatePath('/mvs/admin');
}

export async function adminDeleteResponseTag(
  scenarioFk: string,
  screenId: string,
  optionLabel: string,
) {
  await requireAdmin();
  await deleteResponseTag(scenarioFk, screenId, optionLabel);
  revalidatePath('/mvs/admin');
}

// Phase 1 Freeze admin actions ----------------------------------------------

export async function adminUpdateScenarioMeta(
  scenarioFk: string,
  patch: ScenarioMetaPatch,
) {
  await requireAdmin();
  await updateScenarioMeta(scenarioFk, patch);
  revalidatePath('/mvs/admin');
}

// Day 11.5: scenario-level setup_text editor (recognition-test scenarios).
export async function adminUpdateScenarioSetupText(
  scenarioFk: string,
  setupText: string | null,
) {
  await requireAdmin();
  await updateScenarioSetupText(scenarioFk, setupText);
  revalidatePath('/mvs/admin');
}

// Marker-toggle actions intentionally do NOT call revalidatePath. With ~640
// marker toggles per scenario (80 options × 8 markers) and ~1600 on the MC
// bank, revalidating the entire /mvs/admin tree on every checkbox click is
// prohibitively expensive — it re-runs every dashboard loader (responses,
// long-format, scenario, list, MC questions, response tags). The client
// editors keep optimistic local state via useState; the DB write is the
// source of truth, and the admin page picks up the new values on next nav.
export async function adminUpdateScreenOptionMarkers(
  optionDbId: string,
  markers: Record<string, boolean>,
) {
  await requireAdmin();
  await updateScreenOptionMarkers(optionDbId, markers);
}

export async function adminUpdateMcOptionMarkers(
  optionDbId: string,
  markers: Record<string, boolean>,
) {
  await requireAdmin();
  await updateMcOptionMarkers(optionDbId, markers);
}
