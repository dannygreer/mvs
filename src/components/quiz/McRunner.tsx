'use client';

import { useRef, useCallback } from 'react';
import type { McQuestion } from '@/types';

// Multi-choice runner (Phase 3 certification). Same RT-capture pattern
// as ScenarioScreen.tsx:AnswerScreen (startTimeRef paint→click,
// answeredRef double-click debounce) and the same dark HUD aesthetic
// as Phase 1/2 — but NO countdown timer. Phase 3 is self-paced; the
// timer (and the red threat field) belong to Phase 1/2 only. RT is
// still measured silently for analytics, just not surfaced.

interface McRunnerProps {
  question: McQuestion;
  total: number;
  onResponse: (
    optionLabel: 'A' | 'B' | 'C' | 'D' | null,
    optionId: string | null,
    rtMs: number,
    timedOut: boolean
  ) => void;
}

export default function McRunner({
  question,
  total,
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

  return (
    <div className="relative flex flex-col items-center justify-start flex-1 px-6 pt-[12vh] pb-10">
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,#0e1422_0%,#050810_60%,#000_100%)]" />

      <div className="relative z-10 w-full max-w-2xl space-y-8">
        {/* HUD prompt panel — mirrors ScenarioScreen HudPanel */}
        <div className="relative">
          <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#4FA9F0]" />
          <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#4FA9F0]" />
          <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#4FA9F0]" />
          <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#4FA9F0]" />
          <div
            className="relative bg-zinc-950/60 backdrop-blur-sm"
            style={{ border: '1px solid rgba(1,111,212,0.33)' }}
          >
            <div
              className="flex items-center px-4 py-2 mvs-mono"
              style={{
                borderBottom: '1px dashed rgba(1,111,212,0.28)',
                background:
                  'linear-gradient(180deg, rgba(1,111,212,0.12) 0%, rgba(1,111,212,0.03) 100%)',
              }}
            >
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#4FA9F0]">
                Question {String(question.sequence).padStart(2, '0')} of{' '}
                {String(total).padStart(2, '0')}
              </span>
            </div>
            <div className="p-6 sm:p-8">
              <p className="mvs-body text-lg sm:text-xl text-zinc-200 leading-relaxed">
                {question.prompt}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {question.options.map((option) => (
            <button
              key={option.label}
              onClick={() => handleSelect(option.label, option.id)}
              className="w-full text-left px-6 py-4 mvs-body text-base sm:text-lg bg-zinc-950/55 text-zinc-200 hover:bg-zinc-900/70 transition-colors"
              style={{ border: '1px solid rgba(1,111,212,0.25)' }}
            >
              <span className="mvs-mono text-[#4FA9F0] mr-3">
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
