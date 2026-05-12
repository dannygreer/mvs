'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import McRunner from './McRunner';
import PreviewBanner from './PreviewBanner';
import { submitMcAssessment, submitMcAssessmentByToken } from '@/actions/quiz';
import type { McQuestion, McResponse, Phase } from '@/types';

const DEFAULT_TIME_LIMIT_SECONDS = 30;

type Step = 'in_progress' | 'submitting' | 'results' | 'error';

interface McQuizProps {
  questions: McQuestion[];
  // Auth-mode props (admin or pre-authenticated student testing path).
  enrollmentId?: string;
  studentId?: string;
  phase?: Phase;
  assessmentCode?: string;
  participantId?: string;
  // Day 5b — token-URL mode (no auth). When set, the byToken action
  // derives enrollment, student, phase, and code server-side.
  token?: string;
  // Preview mode (admin QA). Same UI + timing, but the final submit() is
  // skipped — no rows touch responses_long / enrollments. Renders the
  // PreviewBanner at the top.
  previewMode?: boolean;
}

export default function McQuiz({
  questions,
  enrollmentId,
  studentId,
  phase,
  assessmentCode,
  participantId,
  token,
  previewMode,
}: McQuizProps) {
  const [step, setStep] = useState<Step>('in_progress');
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<McResponse[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(
    async (final: McResponse[]) => {
      // Preview mode: skip the submission and jump straight to results.
      // The runner has full in-memory responses but nothing persists.
      if (previewMode) {
        setStep('results');
        return;
      }
      setStep('submitting');
      try {
        if (token) {
          await submitMcAssessmentByToken({ token, responses: final });
        } else if (enrollmentId && studentId && assessmentCode && phase && participantId) {
          await submitMcAssessment({
            enrollmentId,
            studentId,
            assessmentCode,
            phase,
            participantId,
            responses: final,
          });
        } else {
          throw new Error('Missing submission context');
        }
        setStep('results');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Submission failed';
        setErrorMessage(msg);
        setStep('error');
      }
    },
    [previewMode, token, enrollmentId, studentId, assessmentCode, phase, participantId]
  );

  const handleResponse = useCallback(
    (
      optionLabel: 'A' | 'B' | 'C' | 'D' | null,
      optionId: string | null,
      rtMs: number,
      timedOut: boolean
    ) => {
      const current = questions[index];
      const next: McResponse = {
        questionId: current.id,
        sequence: current.sequence,
        optionLabel,
        optionId,
        rtMs,
        timedOut,
      };
      const updated = [...responses, next];
      setResponses(updated);
      if (index + 1 < questions.length) {
        setIndex(index + 1);
      } else {
        submit(updated);
      }
    },
    [index, questions, responses, submit]
  );

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[60vh] text-zinc-500">
        No questions available for this assessment.
      </div>
    );
  }

  if (step === 'submitting') {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[60vh] text-zinc-300 bg-zinc-950">
        Submitting your responses…
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[60vh] bg-zinc-950 px-6">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Submitted</h1>
          <p className="text-zinc-300">Thanks. Your responses are recorded.</p>
          <Link
            href="/app"
            className="inline-block mt-4 px-5 py-2 bg-white text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Back to assignments
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[60vh] bg-zinc-950 px-6">
        <div className="w-full max-w-md bg-red-950 border border-red-700 rounded-xl p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-white">Submission failed</h1>
          <p className="text-red-200 text-sm">{errorMessage}</p>
          <Link
            href="/app"
            className="inline-block mt-2 text-sm text-red-100 hover:underline"
          >
            Back to assignments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {previewMode && <PreviewBanner />}
      <McRunner
        key={questions[index].id}
        question={questions[index]}
        defaultTimeLimitSeconds={DEFAULT_TIME_LIMIT_SECONDS}
        onResponse={handleResponse}
      />
    </>
  );
}
