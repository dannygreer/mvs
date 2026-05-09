'use server';

import {
  insertResponsesLong,
  insertResponseWide,
  getResponseTagMap,
  getActiveScenario,
  deleteResponseByParticipant,
} from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { ScreenResponse, Phase } from '@/types';

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
}

export async function submitAssessment(data: SubmitAssessmentData) {
  if (!data.firstName || !data.lastName) throw new Error('Name is required');
  if (data.responses.length === 0) throw new Error('No responses recorded');

  // Look up response tags for automatic category assignment
  let tagMap: Record<string, string> = {};
  const scenario = await getActiveScenario();
  if (scenario) {
    tagMap = await getResponseTagMap(scenario.dbId);
  }

  // Long format: one row per screen response
  const longRows = data.responses.map((r) => ({
    participant_id: data.participantId,
    first_name: data.firstName,
    last_name: data.lastName,
    phase: data.phase,
    scenario_id: data.scenarioId,
    scenario_version: data.scenarioVersion,
    question_id: r.screenId,
    branch_path: r.branchPath,
    option_selected: r.optionLabel,
    response_category: r.optionLabel
      ? tagMap[`${r.screenId}:${r.optionLabel}`] ?? null
      : null,
    rt_ms: r.rtMs,
    timed_out: r.timedOut,
  }));

  await insertResponsesLong(longRows);

  // Wide format: one summary row
  const wideRow = {
    participant_id: data.participantId,
    first_name: data.firstName,
    last_name: data.lastName,
    phase: data.phase,
    scenario_id: data.scenarioId,
    scenario_version: data.scenarioVersion,
    branch_path: data.branchPath,
    q1_answer: data.responses[0]?.optionLabel ?? null,
    q1_rt: data.responses[0]?.rtMs ?? null,
    q2_answer: data.responses[1]?.optionLabel ?? null,
    q2_rt: data.responses[1]?.rtMs ?? null,
    q3_answer: data.responses[2]?.optionLabel ?? null,
    q3_rt: data.responses[2]?.rtMs ?? null,
    q4_answer: data.responses[3]?.optionLabel ?? null,
    q4_rt: data.responses[3]?.rtMs ?? null,
    q5_answer: data.responses[4]?.optionLabel ?? null,
    q5_rt: data.responses[4]?.rtMs ?? null,
    q6_answer: data.responses[5]?.optionLabel ?? null,
    q6_rt: data.responses[5]?.rtMs ?? null,
    total_time: data.totalTime,
  };

  await insertResponseWide(wideRow);
}

export async function deleteAssessmentResult(id: number): Promise<void> {
  await requireSuperAdmin();
  await deleteResponseByParticipant(id);
  revalidatePath('/mvs/admin');
}
