'use client';

// Day 11 — Day 10 cleanup: MC option marker editor UI.
//
// Mirrors the per-option 8-checkbox grid that lives inside ScenarioBuilderTab
// for screen_options. The server action adminUpdateMcOptionMarkers already
// existed from Day 10's build; this just exposes it as a tab so the doctor
// can tag the 50 multi-choice options against the 8 locked Phase 1 markers.
//
// Defensive note: the loader (loadMcQuestionsForAdmin) does return is_correct
// because admins need to see the answer key while tagging. The data flows
// through here as Server Component → Client Component props (this file is
// 'use client'); never propagate it into a student-facing route.

import { useState, useTransition } from 'react';
import { adminUpdateMcOptionMarkers } from '@/actions/admin';
import type { McAdminAssessment, McAdminQuestion } from '@/lib/db';

const MARKER_KEYS = [
  'escalation',
  'narrowing',
  'premature_commitment',
  'sequencing_break',
  'drift',
  'intervention',
  'recovery',
  'governance_instability',
] as const;
type MarkerKey = (typeof MARKER_KEYS)[number];
const MARKER_LABELS: Record<MarkerKey, string> = {
  escalation: 'Escalation',
  narrowing: 'Narrowing',
  premature_commitment: 'Premature Commitment',
  sequencing_break: 'Sequencing Break',
  drift: 'Drift',
  intervention: 'Intervention',
  recovery: 'Recovery',
  governance_instability: 'Governance Instability',
};

export default function McMarkersTab({
  assessments,
  questions,
  activeAssessmentId,
}: {
  assessments: McAdminAssessment[];
  questions: McAdminQuestion[];
  activeAssessmentId: string | null;
}) {
  if (assessments.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500">
        No multi-choice assessments configured.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900">Test Bank — Option Markers</h3>
          <p className="text-sm text-zinc-500 mt-1">
            50-question certification exam. Tag each option with the 8
            doctrine markers — empty means no markers fire for that option.
          </p>
        </div>
        {assessments.length > 1 && (
          // Picker reload via ?mc_assessment=… on the admin route; for now we
          // just label which assessment is in view since the existing admin
          // page loads one MC assessment at a time.
          <span className="text-xs text-zinc-500 mvs-mono">
            {assessments.find((a) => a.id === activeAssessmentId)?.code ?? '—'}
          </span>
        )}
      </div>

      {questions.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          No questions seeded for the selected assessment.
        </div>
      ) : (
        <ol className="space-y-4">
          {questions.map((q) => (
            <McQuestionRow key={q.id} question={q} />
          ))}
        </ol>
      )}
    </div>
  );
}

function McQuestionRow({ question }: { question: McAdminQuestion }) {
  return (
    <li className="border border-zinc-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
        <p className="text-xs text-zinc-500 font-mono">Q{question.sequence}</p>
        <p className="text-sm text-zinc-900 mt-1">{question.prompt}</p>
      </div>
      <div className="divide-y divide-zinc-100">
        {question.options.map((o) => (
          <McOptionMarkerEditor
            key={o.id}
            optionId={o.id}
            label={o.label}
            text={o.text}
            isCorrect={o.isCorrect}
            initialMarkers={o.triggersMarkers}
          />
        ))}
      </div>
    </li>
  );
}

function McOptionMarkerEditor({
  optionId,
  label,
  text,
  isCorrect,
  initialMarkers,
}: {
  optionId: string;
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect: boolean;
  initialMarkers: Record<string, boolean>;
}) {
  const [markers, setMarkers] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        MARKER_KEYS.map((k) => [k, !!initialMarkers?.[k]]),
      ) as Record<string, boolean>,
  );
  const [pending, startTransition] = useTransition();

  const toggle = (key: MarkerKey) => {
    // Functional setMarkers avoids stale-closure races on rapid clicks: if
    // two toggles fire within one render tick, each call sees the previous
    // committed state rather than the stale `markers` snapshot from render.
    setMarkers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      startTransition(() => adminUpdateMcOptionMarkers(optionId, next));
      return next;
    });
  };

  return (
    <div className="px-4 py-3 flex flex-col md:flex-row md:items-start gap-3">
      <div className="md:w-1/3">
        <p className="text-xs text-zinc-500">
          <span className="font-mono text-zinc-700 mr-2">{label}.</span>
          {isCorrect && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium uppercase">
              correct
            </span>
          )}
        </p>
        <p className="text-sm text-zinc-800 mt-1">{text}</p>
      </div>
      <div className="md:flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
            Markers
          </span>
          {pending && (
            <span className="text-[10px] text-zinc-400">Saving…</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {MARKER_KEYS.map((k) => (
            <label
              key={k}
              className={`flex items-center gap-1 text-xs cursor-pointer px-1 py-0.5 rounded ${
                markers[k] ? 'bg-cyan-50 text-cyan-900' : 'text-zinc-600'
              }`}
            >
              <input
                type="checkbox"
                checked={!!markers[k]}
                onChange={() => toggle(k)}
                disabled={pending}
                className="rounded"
              />
              <span className="truncate" title={MARKER_LABELS[k]}>
                {MARKER_LABELS[k]}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
