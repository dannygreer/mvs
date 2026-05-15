'use client';

import { useRef, useCallback } from 'react';
import CountdownTimer from './CountdownTimer';
import type { ScenarioScreen as ScenarioScreenType } from '@/types';

const BG_IMAGES = ['/bg-q1.jpg', '/bg-q2.jpg', '/bg-q3.jpg'];

// Dark marketing-system backdrop with the scenario photo blended in:
// zinc-950 base, image at low opacity + luminosity blend so it reads as
// atmospheric texture (not a literal photo), plus a radial vignette
// matching PageShell. `tint` adds a faint accent wash — neutral for the
// read phase, red for the heightened answer phase (doctrine: answering
// carries the urgency cue).
function ScenarioBackdrop({
  bgImage,
  tint,
}: {
  bgImage: string;
  tint: 'neutral' | 'urgent';
}) {
  return (
    <>
      <div className="absolute inset-0 bg-zinc-950" />
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.18] grayscale mix-blend-luminosity"
        style={{ backgroundImage: `url('${bgImage}')` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,#0e1422_0%,#050810_60%,#000_100%)]" />
      {tint === 'urgent' && (
        <>
          {/* Erratic red pulse — deliberately irregular timing + swing so
              it reads as threat/pressure, not a calm breathing glow. The
              whole assessment measures decision-making under stress; this
              is an ambient stressor, not a progress/go-faster cue. */}
          <style>{`
            @keyframes threat-pulse {
              0%   { opacity: .20; }
              5%   { opacity: .58; }
              7%   { opacity: .16; }
              18%  { opacity: .40; }
              20%  { opacity: .64; }
              23%  { opacity: .18; }
              41%  { opacity: .52; }
              43%  { opacity: .12; }
              60%  { opacity: .60; }
              63%  { opacity: .24; }
              79%  { opacity: .10; }
              82%  { opacity: .56; }
              91%  { opacity: .30; }
              100% { opacity: .20; }
            }
          `}</style>
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(180,20,20,0.55)_0%,transparent_70%)]"
            style={{
              animation: 'threat-pulse 2.4s linear infinite',
              willChange: 'opacity',
            }}
          />
        </>
      )}
    </>
  );
}

// HUD panel mirroring src/components/marketing/HudCard.tsx — corner
// brackets, thin brand-blue border, mono header strip — on the dark
// scenario backdrop.
function HudPanel({
  label,
  code,
  children,
}: {
  label: string;
  code?: string;
  children: React.ReactNode;
}) {
  return (
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
          className="flex items-center justify-between px-4 py-2 mvs-mono"
          style={{
            borderBottom: '1px dashed rgba(1,111,212,0.28)',
            background:
              'linear-gradient(180deg, rgba(1,111,212,0.12) 0%, rgba(1,111,212,0.03) 100%)',
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#4FA9F0]">
            {label}
          </span>
          {code && (
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 tabular-nums">
              {code}
            </span>
          )}
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

// ── Read phase: scenario text + Continue button (no timer) ──

interface ReadScreenProps {
  screen: ScenarioScreenType;
  screenNumber: number;
  onContinue: () => void;
}

export function ReadScreen({ screen, screenNumber, onContinue }: ReadScreenProps) {
  const bgImage = BG_IMAGES[(screenNumber - 1) % BG_IMAGES.length];

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 px-6 py-10">
      <ScenarioBackdrop bgImage={bgImage} tint="neutral" />

      <div className="relative z-10 w-full max-w-2xl space-y-8">
        <HudPanel label={`Question ${String(screenNumber).padStart(2, '0')}`}>
          <p className="mvs-body text-lg sm:text-xl text-zinc-200 leading-relaxed whitespace-pre-line">
            {screen.text ?? ''}
          </p>
        </HudPanel>

        {screen.prompt && (
          <p className="mvs-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-zinc-100">
            {screen.prompt}
          </p>
        )}

        <button
          onClick={onContinue}
          className="w-full py-3 mvs-mono text-sm uppercase tracking-widest bg-[#016FD4] text-white hover:bg-[#0a5fb0] transition-colors"
        >
          Continue →
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
    <div className="relative flex flex-col items-center justify-center flex-1 px-6 py-10">
      <ScenarioBackdrop bgImage={bgImage} tint="urgent" />

      <div className="relative z-10 w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <span className="mvs-mono text-[10px] uppercase tracking-[0.25em] text-[#F87171]">
            Question {String(screenNumber).padStart(2, '0')}
          </span>
          <CountdownTimer
            seconds={screen.timerSeconds}
            onTimeout={handleTimeout}
          />
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
                className={`w-full text-left px-6 py-4 mvs-body text-base sm:text-lg transition-colors ${
                  isPending
                    ? 'bg-[#016FD4]/20 text-zinc-100'
                    : isDisabled
                      ? 'bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
                      : 'bg-zinc-950/55 text-zinc-200 hover:bg-zinc-900/70'
                }`}
                style={{
                  border: isPending
                    ? '1px solid rgba(1,111,212,0.7)'
                    : '1px solid rgba(1,111,212,0.25)',
                }}
              >
                <span className="mvs-mono text-[#F87171] mr-3">
                  {option.label}.
                </span>
                {option.text}
              </button>
            );
          })}
        </div>

        {commitmentMode === 'revisable' && pendingPick && (
          <div className="space-y-3">
            <p className="text-center mvs-mono text-xs uppercase tracking-widest text-zinc-400">
              Locked in:{' '}
              <span className="text-[#4FA9F0] font-bold">
                {pendingPick.option.label}.
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleChange}
                className="py-3 mvs-mono text-sm uppercase tracking-widest bg-transparent border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Change answer
              </button>
              <button
                onClick={handleContinue}
                className="py-3 mvs-mono text-sm uppercase tracking-widest bg-[#016FD4] text-white hover:bg-[#0a5fb0] transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
