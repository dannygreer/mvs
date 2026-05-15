'use client';

// Wraps the student-landing preview with a top-right mode switch:
//   PREVIEW VIEW  — all phases active, buttons deep-link into the admin
//                   preview runs (what we show by default).
//   STUDENT VIEW  — exact student gating: Phase 1 active, Phase 2 & 3
//                   locked until the prior phase is complete (a fresh
//                   student's real state).
// Hrefs are resolved server-side and passed in; this component only
// toggles which PhaseConfig set + CTA label PhaseLanding receives.
import { useState } from 'react';
import { PHASE_META } from '@/lib/phases';
import PhaseLanding, {
  type PhaseConfig,
} from '@/components/student/PhaseLanding';

type Mode = 'preview' | 'student';

export default function StudentLandingPreviewToggle({
  scenarioHref,
  phase3Href,
}: {
  scenarioHref: string | null;
  phase3Href: string | null;
}) {
  const [mode, setMode] = useState<Mode>('preview');

  const p1desc =
    'Baseline measurement before training. Quick branching scenario.';
  const p2desc =
    'Retake the same scenario at the end of the day. We measure how your decisions changed.';
  const p3desc =
    'End-of-day certification: written test + five video scenarios. Each one starts automatically when the previous finishes.';

  const previewPhases: PhaseConfig[] = [
    { number: 1, title: PHASE_META.phase_1.name, description: p1desc, state: 'active', href: scenarioHref },
    { number: 2, title: PHASE_META.phase_2.name, description: p2desc, state: 'active', href: scenarioHref },
    { number: 3, title: PHASE_META.phase_3.name, description: p3desc, state: 'active', href: phase3Href },
  ];

  // Fresh student: Phase 1 open, the rest locked until prior completes.
  const studentPhases: PhaseConfig[] = [
    { number: 1, title: PHASE_META.phase_1.name, description: p1desc, state: 'active', href: scenarioHref },
    { number: 2, title: PHASE_META.phase_2.name, description: p2desc, state: 'locked', href: null },
    { number: 3, title: PHASE_META.phase_3.name, description: p3desc, state: 'locked', href: null },
  ];

  const isStudent = mode === 'student';

  return (
    <>
      {/* Marketing-site backdrop: near-white lab() base with a soft
          light-blue/slate radial glow centered above the cards. */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundColor: 'lab(96.1634% .0993311 -.364041)',
          backgroundImage:
            'radial-gradient(ellipse 70% 60% at 50% 38%, rgba(219,234,254,0.55), rgba(241,245,249,0.35) 45%, transparent 78%)',
        }}
      />
      <div className="fixed top-4 right-4 z-50 flex rounded-lg border border-zinc-300 bg-white shadow-md overflow-hidden mvs-mono text-[10px] uppercase tracking-widest">
        <button
          type="button"
          onClick={() => setMode('student')}
          className={`px-3 py-2 transition-colors ${
            isStudent
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          Student view
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={`px-3 py-2 transition-colors ${
            !isStudent
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          Preview view
        </button>
      </div>

      <PhaseLanding
        eyebrow="Session day"
        heading="Hi, Student."
        intro="Three phases today. Complete each one in order — the next phase unlocks when you finish the previous."
        phases={isStudent ? studentPhases : previewPhases}
        ctaLabel={isStudent ? 'Start →' : 'Preview →'}
        ctaNewTab
      />
    </>
  );
}
