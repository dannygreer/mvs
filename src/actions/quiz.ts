'use server';

import {
  insertResponsesLong,
  insertResponseWide,
  getResponseTagMap,
  getActiveScenario,
  deleteResponseByParticipant,
} from '@/lib/db';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';
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
  // Day 4 — set when invoked from /app/take/[enrollmentId].
  // Both fields must be present together; the action validates that the
  // enrollment exists, belongs to studentId, and isn't already completed.
  enrollmentId?: string;
  studentId?: string;
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
      .select('id, student_id, completed_at')
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
  }

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
    enrollment_id: data.enrollmentId ?? null,
    student_id: authedStudentId,
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
    enrollment_id: data.enrollmentId ?? null,
    student_id: authedStudentId,
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
