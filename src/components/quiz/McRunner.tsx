'use client';

import { useRef, useCallback } from 'react';
import CountdownTimer from './CountdownTimer';
import type { McQuestion } from '@/types';

// Multi-choice runner. Mirrors the doctrine-locked reaction-time pattern
// from src/components/quiz/ScenarioScreen.tsx:AnswerScreen exactly:
//   - startTimeRef = useRef(Date.now()) at mount, paint→click measurement
//   - answeredRef debounce so a double-click never produces two responses
//   - timeout follows the same path; option_selected = null, timed_out = true
// Single question + 4 options on screen. No back button. No progress
// indicator. Auto-advance is handled by the parent McQuiz on response.

interface McRunnerProps {
  question: McQuestion;
  defaultTimeLimitSeconds: number;
  onResponse: (
    optionLabel: 'A' | 'B' | 'C' | 'D' | null,
    optionId: string | null,
    rtMs: number,
    timedOut: boolean
  ) => void;
}

export default function McRunner({
  question,
  defaultTimeLimitSeconds,
  onResponse,
}: McRunnerProps) {
  const startTimeRef = useRef(Date.now());
  const answeredRef = useRef(false);

  const handleSelect = useCallback(
    (label: 'A' | 'B' | 'C' | 'D', optionId: string) => {
      if (answeredRef.current) return;
      answeredRef.current = true;
      const elapsed = Date.now() - startTimeRef.current;
      onResponse(label, optionId, elapsed, false);
    },
    [onResponse]
  );

  const handleTimeout = useCallback(() => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    const elapsed = Date.now() - startTimeRef.current;
    onResponse(null, null, elapsed, true);
  }, [onResponse]);

  const timerSeconds = question.timeLimitSeconds ?? defaultTimeLimitSeconds;

  return (
    <div className="relative flex flex-col items-center justify-start flex-1 px-6 py-12 bg-zinc-950">
      <div className="relative w-full max-w-2xl space-y-8">
        <div className="flex justify-center">
          <CountdownTimer seconds={timerSeconds} onTimeout={handleTimeout} />
        </div>

        <p className="text-2xl text-white leading-relaxed text-center">
          {question.prompt}
        </p>

        <div className="space-y-3">
          {question.options.map((option) => (
            <button
              key={option.label}
              onClick={() => handleSelect(option.label, option.id)}
              className="w-full text-left px-6 py-4 bg-zinc-900 border border-zinc-700 rounded-xl text-lg text-white transition-all hover:border-white hover:bg-zinc-800"
            >
              <span className="font-medium text-zinc-500 mr-3">
                {option.label}.
              </span>
              {option.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
