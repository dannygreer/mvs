'use client';

// Shared per-option doctrine editor (Phase A — Scully scoring
// realignment). Used by both ScenarioBuilderTab (screen_options) and
// McMarkersTab (mc_options). Replaces the old 8 boolean checkboxes
// with integer WEIGHT inputs (-3…+3) + an option_classification
// dropdown + a rationale textarea, per the Phase 1 Marker Assignment
// Doctrine / Report Generation Logic §3.1.
//
// Autosave: weights save on blur of each input; classification saves
// on change; rationale on blur. Markers are ref-mirrored so rapid
// edits stay race-safe without a side effect inside a setState updater
// (illegal in React 19).
import { useRef, useState, useTransition } from 'react';

export const MARKER_KEYS = [
  'escalation',
  'narrowing',
  'premature_commitment',
  'sequencing_break',
  'drift',
  'intervention',
  'recovery',
  'governance_instability',
] as const;
export type MarkerKey = (typeof MARKER_KEYS)[number];

export const MARKER_LABELS: Record<MarkerKey, string> = {
  escalation: 'Escalation',
  narrowing: 'Narrowing',
  premature_commitment: 'Premature Commitment',
  sequencing_break: 'Sequencing Break',
  drift: 'Drift',
  intervention: 'Intervention',
  recovery: 'Recovery (−)',
  governance_instability: 'Governance Instability',
};

// Option-level classification labels. Superset of the original Report
// Generation Logic §5.1 set + the labels introduced by the Missing
// Node Marker Completion Matrix (Controlled / Adaptive, Unsafe / High
// Risk, Controlled but Passive). Scully's vocabulary is canonical.
export const OPTION_CLASSIFICATIONS = [
  'Controlled / Stabilizing',
  'Controlled / Adaptive',
  'Controlled but Passive',
  'Premature Commitment / Acceleration',
  'Drift / Delayed Commitment',
  'Sequencing Instability',
  'Governance Instability',
  'Unsafe / High Risk',
  'Acceptable / Neutral',
] as const;

interface Props {
  initialMarkers: Record<string, number>;
  initialClassification: string | null;
  initialRationale: string | null;
  saveMarkers: (markers: Record<string, number>) => Promise<void>;
  saveDoctrine: (patch: {
    option_classification?: string | null;
    rationale?: string | null;
  }) => Promise<void>;
}

export default function MarkerWeightGrid({
  initialMarkers,
  initialClassification,
  initialRationale,
  saveMarkers,
  saveDoctrine,
}: Props) {
  const [markers, setMarkers] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      MARKER_KEYS.map((k) => [k, Number(initialMarkers?.[k] ?? 0) || 0]),
    ),
  );
  const markersRef = useRef(markers);
  const [classification, setClassification] = useState(
    initialClassification ?? '',
  );
  const [rationale, setRationale] = useState(initialRationale ?? '');
  const [pending, startTransition] = useTransition();

  const commitMarkers = (key: MarkerKey, raw: string) => {
    let v = parseInt(raw, 10);
    if (Number.isNaN(v)) v = 0;
    v = Math.max(-3, Math.min(3, v));
    const next = { ...markersRef.current, [key]: v };
    markersRef.current = next;
    setMarkers(next);
    startTransition(async () => {
      try {
        await saveMarkers(next);
      } catch (e) {
        console.error('Marker weight save failed', e);
      }
    });
  };

  const commitClassification = (value: string) => {
    setClassification(value);
    startTransition(async () => {
      try {
        await saveDoctrine({ option_classification: value || null });
      } catch (e) {
        console.error('Classification save failed', e);
      }
    });
  };

  const commitRationale = () => {
    const trimmed = rationale.trim();
    if (trimmed === (initialRationale ?? '').trim()) return;
    startTransition(async () => {
      try {
        await saveDoctrine({ rationale: trimmed || null });
      } catch (e) {
        console.error('Rationale save failed', e);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
          Marker weights (−3…+3 · recovery negative = stabilizing)
        </span>
        {pending && <span className="text-[10px] text-zinc-400">Saving…</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MARKER_KEYS.map((k) => {
          const v = markers[k] ?? 0;
          return (
            <label
              key={k}
              className={`flex items-center justify-between gap-1 text-xs px-2 py-1 rounded border ${
                v !== 0
                  ? 'bg-cyan-50 border-cyan-200 text-cyan-900'
                  : 'border-zinc-200 text-zinc-600'
              }`}
            >
              <span className="truncate" title={MARKER_LABELS[k]}>
                {MARKER_LABELS[k]}
              </span>
              <input
                type="number"
                min={-3}
                max={3}
                step={1}
                defaultValue={v}
                onBlur={(e) => commitMarkers(k, e.target.value)}
                disabled={pending}
                className="w-12 text-center tabular-nums border border-zinc-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </label>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <select
          value={classification}
          onChange={(e) => commitClassification(e.target.value)}
          disabled={pending}
          className="text-xs px-2 py-1.5 border border-zinc-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
        >
          <option value="">— Classification —</option>
          {OPTION_CLASSIFICATIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          onBlur={commitRationale}
          placeholder="Doctrine rationale (short)"
          disabled={pending}
          className="text-xs px-2 py-1.5 border border-zinc-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
      </div>
    </div>
  );
}
