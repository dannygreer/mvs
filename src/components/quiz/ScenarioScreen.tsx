'use client';

import { useRef, useCallback } from 'react';
import CountdownTimer from './CountdownTimer';
import type { ScenarioScreen as ScenarioScreenType } from '@/types';

const BG_IMAGES = ['/bg-q1.jpg', '/bg-q2.jpg', '/bg-q3.jpg'];

// ── Read phase: scenario text + Continue button (no timer) ──

interface ReadScreenProps {
  screen: ScenarioScreenType;
  screenNumber: number;
  onContinue: () => void;
}

export function ReadScreen({ screen, screenNumber, onContinue }: ReadScreenProps) {
  const bgImage = BG_IMAGES[(screenNumber - 1) % BG_IMAGES.length];

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-6">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat grayscale"
        style={{ backgroundImage: `url('${bgImage}')` }}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative w-full max-w-2xl space-y-8">
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 bg-white/20 text-white">
            Step {screenNumber}
          </span>
        </div>

        <div className="bg-white/90 border border-zinc-200 rounded-xl p-8 space-y-4">
          <h2 className="text-lg font-medium text-zinc-500 uppercase tracking-wide">
            Scenario
          </h2>
          <p className="text-xl text-zinc-900 leading-relaxed whitespace-pre-line">
            {screen.text}
          </p>
        </div>

        {screen.prompt && (
          <p className="text-xl font-bold text-white">
            {screen.prompt}
          </p>
        )}

        <button
          onClick={onContinue}
          className="w-full py-3 rounded-lg font-medium text-lg transition-colors bg-white text-zinc-900 hover:bg-zinc-100"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Answer phase: options + countdown timer ──
//
// Two commitment modes (Phase 1 Freeze):
//   - locked: select an option, auto-submit, advance immediately.
//   - revisable: select an option, see "Locked in: X" + Continue / Change.
//     Change clears the selection and resets the RT clock. Each lock-in is
//     an event row; revision_number increments per lock-in on this screen.
//
// Doctrine guards (per `docs/phase1_freeze.md` + `CLAUDE.md`):
//   - No back-to-previous-screen nav, even in revisable mode.
//   - No progress bars or "go faster" cues.
//   - RT remains client-side: paint -> click. On revisable, the RT of the
//     revision is paint-of-current-iteration -> revision-click (not original-
//     mount -> revision-click), per Dr. Scully's "revision latency" spec.

import { useState } from 'react';
import type { ScenarioOption } from '@/types';

interface AnswerScreenProps {
  screen: ScenarioScreenType;
  screenNumber: number;
  commitmentMode: 'locked' | 'revisable';
  // Locked mode: one terminal commit.
  // Revisable mode: emits an event per Change (revision_number=0 original,
  // then 1,2,...) AND a final commit. Quiz.tsx collates these into rows.
  onResponse: (
    event: AnswerEvent,
  ) => void;
}

export interface AnswerEvent {
  optionLabel: string | null;
  optionId: string | null;
  rtMs: number;
  timedOut: boolean;
  // revisable mode only: true while the student is overwriting a previous
  // lock-in on the SAME screen. The final continue-click is isRevision=false
  // for the first event and isRevision=true for any subsequent commit; the
  // collator in Quiz.tsx handles revision_number assignment per screen.
  kind: 'commit' | 'revise';
}

export function AnswerScreen({
  screen,
  screenNumber,
  commitmentMode,
  onResponse,
}: AnswerScreenProps) {
  const startTimeRef = useRef(Date.now());
  const answeredRef = useRef(false);

  // Revisable-mode state. Once the student picks, we lock the choice but
  // give them an explicit Continue / Change branch. Both are timed: the
  // countdown keeps running even after a tentative pick.
  const [pendingPick, setPendingPick] = useState<{
    option: ScenarioOption;
    rtMs: number;
  } | null>(null);

  const bgImage = BG_IMAGES[(screenNumber - 1) % BG_IMAGES.length];

  const handleSelect = useCallback(
    (option: ScenarioOption) => {
      if (answeredRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      if (commitmentMode === 'locked') {
        answeredRef.current = true;
        onResponse({
          optionLabel: option.label,
          optionId: option.id,
          rtMs: elapsed,
          timedOut: false,
          kind: 'commit',
        });
      } else {
        // revisable: stash a tentative pick, wait for Continue/Change.
        setPendingPick({ option, rtMs: elapsed });
      }
    },
    [onResponse, commitmentMode],
  );

  const handleTimeout = useCallback(() => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    const elapsed = Date.now() - startTimeRef.current;
    // On timeout, commit whatever the tentative pick is (if any). If
    // nothing was picked, fire a null/timed-out event.
    if (pendingPick) {
      onResponse({
        optionLabel: pendingPick.option.label,
        optionId: pendingPick.option.id,
        rtMs: pendingPick.rtMs,
        timedOut: false,
        kind: 'commit',
      });
    } else {
      onResponse({
        optionLabel: null,
        optionId: null,
        rtMs: elapsed,
        timedOut: true,
        kind: 'commit',
      });
    }
  }, [onResponse, pendingPick]);

  const handleContinue = useCallback(() => {
    if (!pendingPick || answeredRef.current) return;
    answeredRef.current = true;
    onResponse({
      optionLabel: pendingPick.option.label,
      optionId: pendingPick.option.id,
      rtMs: pendingPick.rtMs,
      timedOut: false,
      kind: 'commit',
    });
  }, [onResponse, pendingPick]);

  const handleChange = useCallback(() => {
    if (!pendingPick || answeredRef.current) return;
    // Emit a `revise` event capturing the option the student is abandoning.
    // The collator in Quiz.tsx writes this as a separate row with
    // revision_number = N (incrementing). Then we reset the RT clock so
    // the next pick measures revision latency from this moment, per spec.
    onResponse({
      optionLabel: pendingPick.option.label,
      optionId: pendingPick.option.id,
      rtMs: pendingPick.rtMs,
      timedOut: false,
      kind: 'revise',
    });
    setPendingPick(null);
    startTimeRef.current = Date.now();
  }, [onResponse, pendingPick]);

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-6">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat grayscale"
        style={{ backgroundImage: `url('${bgImage}')` }}
      />
      <div className="absolute inset-0 bg-red-900/60" />

      <div className="relative w-full max-w-2xl space-y-6">
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 bg-white/20 text-white">
            Step {screenNumber}
          </span>
        </div>

        <div className="flex justify-center">
          <CountdownTimer seconds={screen.timerSeconds} onTimeout={handleTimeout} />
        </div>

        <div className="space-y-3">
          {screen.options.map((option) => {
            const isPending = pendingPick?.option.id === option.id;
            const isDisabled =
              commitmentMode === 'revisable' && pendingPick !== null && !isPending;
            return (
              <button
                key={option.label}
                onClick={() => handleSelect(option)}
                disabled={isDisabled}
                className={`w-full text-left px-6 py-4 border rounded-xl text-lg transition-all ${
                  isPending
                    ? 'border-cyan-400 bg-cyan-50 text-zinc-900 shadow-md'
                    : isDisabled
                      ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                      : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-900 hover:bg-zinc-50 hover:shadow-sm'
                }`}
              >
                <span className="font-medium text-zinc-400 mr-3">
                  {option.label}.
                </span>
                {option.text}
              </button>
            );
          })}
        </div>

        {commitmentMode === 'revisable' && pendingPick && (
          <div className="space-y-3">
            <p className="text-center text-white font-medium">
              Locked in:{' '}
              <span className="text-cyan-300 font-bold">
                {pendingPick.option.label}.
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleChange}
                className="py-3 rounded-lg font-medium text-lg bg-white/10 border border-white/40 text-white hover:bg-white/20 transition-colors"
              >
                Change answer
              </button>
              <button
                onClick={handleContinue}
                className="py-3 rounded-lg font-medium text-lg bg-white text-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
