'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ScreenResponse } from '@/types';

interface ResultsScreenProps {
  firstName: string;
  responses: ScreenResponse[];
  // Where to send the student after this screen. Phase 3 sub-
  // assessments pass /app/phase-3/next so the battery auto-chains;
  // standalone runs default to /app (the session-day landing).
  nextHref?: string;
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

export default function ResultsScreen({
  firstName,
  responses,
  nextHref = '/app',
}: ResultsScreenProps) {
  const router = useRouter();
  const isChain = nextHref !== '/app';
  const totalTime = responses.reduce((sum, r) => sum + r.rtMs, 0);

  useEffect(() => {
    if (!isChain) return;
    const id = window.setTimeout(() => router.replace(nextHref), 1500);
    return () => window.clearTimeout(id);
  }, [isChain, nextHref, router]);

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-6 py-10">
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,#0e1422_0%,#050810_60%,#000_100%)]" />

      <div className="relative z-10 w-full max-w-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#016FD4]/20 border border-[#4FA9F0]/40">
            <svg
              className="w-6 h-6 text-[#4FA9F0]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="mvs-display text-2xl font-bold uppercase tracking-wide text-zinc-100">
            Assessment Complete
          </h1>
          <p className="text-zinc-400 text-sm">
            Thank you, {firstName}. Your responses have been recorded.
          </p>
        </div>

        <div className="relative">
          <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#4FA9F0]" />
          <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#4FA9F0]" />
          <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#4FA9F0]" />
          <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#4FA9F0]" />
          <div
            className="relative bg-zinc-950/60 backdrop-blur-sm px-5 py-4 space-y-2"
            style={{ border: '1px solid rgba(1,111,212,0.33)' }}
          >
            <h2 className="mvs-mono text-[10px] uppercase tracking-[0.25em] text-[#4FA9F0] pb-1">
              Your Responses
            </h2>
            {responses.map((r, i) => (
              <div
                key={i}
                className="flex items-baseline gap-3 border-t border-zinc-800/70 pt-2 first:border-0 first:pt-0"
              >
                <span className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 shrink-0 w-12">
                  S{i + 1}
                </span>
                <span className="text-sm text-zinc-200 flex-1 min-w-0">
                  {r.timedOut
                    ? 'No response (time expired)'
                    : `${r.optionLabel}. ${r.optionText}`}
                </span>
                <span className="mvs-mono text-[10px] text-zinc-500 shrink-0 tabular-nums">
                  {formatTime(r.rtMs)}
                  {r.timedOut && ' ⏱'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mvs-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Total response time: {formatTime(totalTime)}
        </div>

        <div className="text-center">
          <Link
            href={nextHref}
            className="inline-block px-5 py-3 mvs-mono text-sm uppercase tracking-widest bg-[#016FD4] text-white hover:bg-[#0a5fb0] transition-colors"
          >
            {isChain ? 'Continue →' : 'Back to your session'}
          </Link>
        </div>
      </div>
    </div>
  );
}
