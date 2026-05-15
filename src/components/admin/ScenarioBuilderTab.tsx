'use client';

import { useRef, useState, useTransition } from 'react';
import type {
  Scenario,
  ScenarioScreen,
  ScenarioOption,
  ScenarioListItem,
} from '@/types';
import {
  adminSetActiveScenario,
  adminUpdateScreenText,
  adminUpdateScreenPrompt,
  adminUpdateScreenTimer,
  adminUpdateOptionText,
  adminUpdateOptionRoute,
  adminAddScreen,
  adminAddOption,
  adminDeleteScreen,
  adminDeleteOption,
  adminUpdateScenarioMeta,
  adminUpdateScenarioSetupText,
  adminUpdateScenarioVideo,
  adminUpdateScreenOptionMarkers,
} from '@/actions/admin';

// The 8 locked Phase 1 Freeze markers — same order everywhere they're shown.
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

// Classification-tag enum value lists, mirroring the migration 0012 checks.
const CLASSIFICATION_FIELDS = [
  {
    key: 'domain' as const,
    label: 'Domain',
    options: ['tactical', 'medical', 'leadership', 'executive'] as const,
  },
  {
    key: 'compression_level' as const,
    label: 'Compression Level',
    options: ['low', 'moderate', 'high', 'extreme'] as const,
  },
  {
    key: 'ambiguity' as const,
    label: 'Ambiguity',
    options: ['low', 'moderate', 'high'] as const,
  },
  {
    key: 'emotional_load' as const,
    label: 'Emotional Load',
    options: ['low', 'moderate', 'high'] as const,
  },
  {
    key: 'sensory_complexity' as const,
    label: 'Sensory Complexity',
    options: ['low', 'moderate', 'high'] as const,
  },
  {
    key: 'time_pressure' as const,
    label: 'Time Pressure',
    options: ['low', 'moderate', 'high'] as const,
  },
  {
    key: 'casualty_complexity' as const,
    label: 'Casualty Complexity',
    options: ['none', 'single', 'multiple', 'mass'] as const,
  },
  {
    key: 'governance_challenge' as const,
    label: 'Governance Challenge',
    options: ['individual', 'team', 'organizational'] as const,
  },
] as const;

// ============================================================
// Main tab component
// ============================================================

interface ScenarioBuilderTabProps {
  scenario: Scenario | null;
  scenarios: ScenarioListItem[];
  // Hide the video editor card. Phase 1 (active_threat) is text-and-
  // branching only; only the Phase 3 video scenarios should expose it.
  hideVideo?: boolean;
  // Hide per-screen timer chip + editor and the timer input on Add
  // Screen. Phase 3 scenarios + the written test don't use timers; only
  // Phase 1/2 (active_threat) do.
  hideTimer?: boolean;
}

export default function ScenarioBuilderTab({
  scenario,
  scenarios,
  hideVideo = false,
  hideTimer = false,
}: ScenarioBuilderTabProps) {
  const [expandedScreen, setExpandedScreen] = useState<string | null>(null);
  const [showAddScreen, setShowAddScreen] = useState(false);

  if (!scenario) {
    return (
      <div className="p-8 text-center text-zinc-500">
        No scenario loaded. Run <code>supabase/seed.sql</code> to create one.
      </div>
    );
  }

  const screens = Object.values(scenario.screens).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const allScreenIds = screens.map((s) => s.id);

  return (
    <div className="p-6 space-y-6">
      {/* Scenario info */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-900">{scenario.title}</h3>
            <p className="text-sm text-zinc-500">
              ID: {scenario.scenarioId} | Version: {scenario.version} | Entry:{' '}
              {scenario.entryScreenId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {scenarios.length > 1 && (
              <ScenarioSelector
                scenarios={scenarios}
                activeId={scenario.dbId}
              />
            )}
            <a
              href={`/mvs/admin/preview/scenario/${scenario.dbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mvs-mono inline-flex items-center gap-1 px-3 py-1.5 border border-zinc-300 text-[10px] uppercase tracking-widest text-zinc-700 hover:bg-white transition-colors"
              title="Run this scenario as if you were a student — no data is recorded"
            >
              Preview ↗
            </a>
          </div>
        </div>
        <p className="text-sm text-zinc-500 mt-1">
          {screens.length} screens configured
        </p>
      </div>

      {/* Day 11.5: scenario-level setup text. Shown for recognition-test
          scenarios (the 5 new ones with setupText populated). Hidden for
          active-threat which uses per-screen branching narrative. */}
      {scenario.setupText !== null && (
        <SetupTextEditor scenario={scenario} />
      )}

      {/* Day 11: video metadata editor — paste a Supabase Storage URL +
          duration, or clear both to remove. */}
      {!hideVideo && <VideoEditor scenario={scenario} />}

      {/* Phase 1 Freeze: scenario meta editor (commitment mode + 9 tags) */}
      <ScenarioMetaEditor scenario={scenario} />

      {/* Screen list */}
      <div className="space-y-3">
        {screens.map((screen) => (
          <ScreenCard
            key={screen.dbId}
            screen={screen}
            isExpanded={expandedScreen === screen.dbId}
            onToggle={() =>
              setExpandedScreen(
                expandedScreen === screen.dbId ? null : screen.dbId,
              )
            }
            allScreenIds={allScreenIds}
            scenarioFk={scenario.dbId}
            usesSetupText={scenario.setupText !== null}
            hideTimer={hideTimer}
          />
        ))}
      </div>

      {/* Add screen */}
      {showAddScreen ? (
        <AddScreenForm
          scenarioFk={scenario.dbId}
          nextSortOrder={screens.length + 1}
          onDone={() => setShowAddScreen(false)}
          hideTimer={hideTimer}
        />
      ) : (
        <button
          onClick={() => setShowAddScreen(true)}
          className="w-full py-3 border-2 border-dashed border-zinc-300 rounded-lg text-zinc-500 hover:border-zinc-400 hover:text-zinc-600 transition-colors"
        >
          + Add Screen
        </button>
      )}
    </div>
  );
}

// ============================================================
// Day 11.5: scenario-level setup text editor (recognition-test scenarios)
// ============================================================

function SetupTextEditor({ scenario }: { scenario: Scenario }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(scenario.setupText ?? '');
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      // Trim whitespace; treat whitespace-only as null so the admin can
      // intentionally clear the field by deleting the contents.
      const trimmed = text.trim();
      await adminUpdateScenarioSetupText(scenario.dbId, trimmed || null);
      setEditing(false);
    });
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-zinc-900">Setup Text</h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            Shown to the student once before Q1. Skipped if the scenario has a
            video.
          </p>
        </div>
        {pending && <span className="text-xs text-zinc-400">Saving…</span>}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="px-3 py-1 bg-zinc-900 text-white rounded text-xs font-medium disabled:bg-zinc-400"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => {
                setText(scenario.setupText ?? '');
                setEditing(false);
              }}
              className="px-3 py-1 border border-zinc-300 rounded text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-700 whitespace-pre-line">
          {scenario.setupText ?? ''}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Day 11: scenario video editor
// ============================================================

function VideoEditor({ scenario }: { scenario: Scenario }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(scenario.videoUrl ?? '');
  const [duration, setDuration] = useState(
    scenario.videoDurationSeconds != null
      ? String(scenario.videoDurationSeconds)
      : '',
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setUrl(scenario.videoUrl ?? '');
    setDuration(
      scenario.videoDurationSeconds != null
        ? String(scenario.videoDurationSeconds)
        : '',
    );
    setError(null);
  };

  const save = () => {
    setError(null);
    const trimmed = url.trim();
    const d = duration.trim() === '' ? null : Number(duration);
    if (!trimmed && d == null) {
      // Clearing both — allowed.
    } else if (!trimmed || d == null || !Number.isFinite(d) || d <= 0) {
      setError(
        'Both video URL and duration (positive seconds) are required, or leave both empty to clear.',
      );
      return;
    }
    startTransition(async () => {
      try {
        await adminUpdateScenarioVideo(scenario.dbId, trimmed, d);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
      }
    });
  };

  const hasVideo = scenario.videoUrl !== null;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-zinc-900">Video</h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            Shown to the student before Q1. When set, replaces the setup
            screen and per-screen reading text.
          </p>
        </div>
        {pending && <span className="text-xs text-zinc-400">Saving…</span>}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-zinc-600 uppercase tracking-wide block mb-1">
              Video URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://<supabase-storage>/scenario.mp4 — or leave empty to clear"
              className="w-full px-3 py-2 border border-zinc-300 rounded text-sm text-zinc-900 font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 uppercase tracking-wide block mb-1">
              Duration (seconds)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 6"
              className="w-32 px-3 py-2 border border-zinc-300 rounded text-sm text-zinc-900 font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="px-3 py-1 bg-zinc-900 text-white rounded text-xs font-medium disabled:bg-zinc-400"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => {
                reset();
                setEditing(false);
              }}
              className="px-3 py-1 border border-zinc-300 rounded text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : hasVideo ? (
        <div className="text-sm text-zinc-700 space-y-1">
          <p className="font-mono break-all">{scenario.videoUrl}</p>
          <p className="text-xs text-zinc-500">
            {scenario.videoDurationSeconds}s
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 italic">
          No video set. (Scenario uses setup text or per-screen reading
          based on its other fields.)
        </p>
      )}
    </div>
  );
}

// ============================================================
// Scenario meta editor — commitment mode + 9 classification tags
// ============================================================

function ScenarioMetaEditor({ scenario }: { scenario: Scenario }) {
  const [pending, startTransition] = useTransition();
  const c = scenario.classification;

  const save = (patch: Parameters<typeof adminUpdateScenarioMeta>[1]) => {
    startTransition(() => adminUpdateScenarioMeta(scenario.dbId, patch));
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-900">
          Scenario Metadata (Phase 1 Freeze)
        </h4>
        {pending && <span className="text-xs text-zinc-400">Saving…</span>}
      </div>

      {/* Commitment mode toggle — the doctrine switch. Locked = no answer
          revisions; Revisable = revisions tracked as additional rows. */}
      <div>
        <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-2">
          Commitment Mode
        </label>
        <div className="inline-flex rounded-lg border border-zinc-300 overflow-hidden">
          {(['locked', 'revisable'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => save({ commitment_mode: mode })}
              disabled={pending}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                scenario.commitmentMode === mode
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          {scenario.commitmentMode === 'locked'
            ? 'No answer revisions. Tactical / acute / high-compression domains.'
            : 'Revisions allowed and logged. Leadership / executive / educational domains.'}
        </p>
      </div>

      {/* Classification tag grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CLASSIFICATION_FIELDS.map((f) => {
          const value = c[
            f.key === 'compression_level'
              ? 'compressionLevel'
              : f.key === 'emotional_load'
                ? 'emotionalLoad'
                : f.key === 'sensory_complexity'
                  ? 'sensoryComplexity'
                  : f.key === 'time_pressure'
                    ? 'timePressure'
                    : f.key === 'casualty_complexity'
                      ? 'casualtyComplexity'
                      : f.key === 'governance_challenge'
                        ? 'governanceChallenge'
                        : (f.key as 'domain' | 'ambiguity')
          ] as string | null;
          return (
            <div key={f.key}>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1">
                {f.label}
              </label>
              <select
                value={value ?? ''}
                disabled={pending}
                onChange={(e) => {
                  const v = e.target.value || null;
                  save({ [f.key]: v as never });
                }}
                className="w-full text-sm px-2 py-1.5 border border-zinc-300 rounded disabled:opacity-50"
              >
                <option value="">— unset —</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          );
        })}

        {/* Authority conflict is boolean — separate tri-state toggle */}
        <div>
          <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1">
            Authority Conflict
          </label>
          <select
            value={c.authorityConflict === null ? '' : String(c.authorityConflict)}
            disabled={pending}
            onChange={(e) => {
              const raw = e.target.value;
              const v = raw === '' ? null : raw === 'true';
              save({ authority_conflict: v });
            }}
            className="w-full text-sm px-2 py-1.5 border border-zinc-300 rounded disabled:opacity-50"
          >
            <option value="">— unset —</option>
            <option value="true">present</option>
            <option value="false">absent</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Scenario selector
// ============================================================

function ScenarioSelector({
  scenarios,
  activeId,
}: {
  scenarios: ScenarioListItem[];
  activeId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      className="text-sm border border-zinc-300 rounded px-2 py-1 disabled:opacity-50"
      value={activeId}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => adminSetActiveScenario(e.target.value))
      }
    >
      {scenarios.map((s) => (
        <option key={s.id} value={s.id}>
          {s.scenario_id} ({s.version})
          {s.is_active ? ' \u2713' : ''}
        </option>
      ))}
    </select>
  );
}

// ============================================================
// Screen card (collapsible)
// ============================================================

function ScreenCard({
  screen,
  isExpanded,
  onToggle,
  allScreenIds,
  scenarioFk,
  usesSetupText,
  hideTimer,
}: {
  screen: ScenarioScreen;
  isExpanded: boolean;
  onToggle: () => void;
  allScreenIds: string[];
  scenarioFk: string;
  // Day 11.5: scenario uses scenario-level setup_text; per-screen text is
  // null and the ScreenTextEditor should render a "not used" notice.
  usesSetupText: boolean;
  hideTimer: boolean;
}) {
  const [delPending, startDel] = useTransition();

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-zinc-50 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm font-medium text-zinc-900 shrink-0">
            {screen.id}
          </span>
          <span className="text-sm text-zinc-500 truncate">
            {/* Day 11.5: preview the prompt (varies per question) rather
                than screen_text (which is null for recognition-test
                scenarios, or duplicate across rows for the old shape). */}
            {(screen.prompt || screen.text || '(no prompt)').substring(0, 80)}
            {((screen.prompt || screen.text || '').length > 80 ? '…' : '')}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {!hideTimer && (
            <span className="text-xs text-zinc-400">{screen.timerSeconds}s</span>
          )}
          <span className="text-zinc-400">{isExpanded ? '\u25BC' : '\u25B6'}</span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-zinc-200 p-4 space-y-4 bg-zinc-50">
          <ScreenTextEditor screen={screen} usesSetupText={usesSetupText} />
          <PromptEditor screen={screen} />
          {!hideTimer && <TimerEditor screen={screen} />}

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-700">Options</h4>
            {screen.options.map((option) => (
              <OptionEditor
                key={option.id}
                option={option}
                allScreenIds={allScreenIds}
              />
            ))}
            <AddOptionForm
              screenFk={screen.dbId}
              nextSortOrder={screen.options.length + 1}
            />
          </div>

          <div className="pt-2 border-t border-zinc-200">
            <button
              onClick={() => {
                if (
                  !confirm(
                    `Delete screen "${screen.id}" and all its options?`,
                  )
                )
                  return;
                startDel(() => adminDeleteScreen(screen.dbId));
              }}
              disabled={delPending}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {delPending ? 'Deleting...' : 'Delete this screen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Screen text editor
// ============================================================

function ScreenTextEditor({
  screen,
  usesSetupText,
}: {
  screen: ScenarioScreen;
  usesSetupText: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(screen.text ?? '');
  const [pending, startTransition] = useTransition();

  // Day 11.5: scenario uses scenario-level setup_text. Per-screen text is
  // intentionally null. Surface that explicitly so the admin doesn't paste
  // setup back into the wrong column.
  if (usesSetupText) {
    return (
      <div className="text-xs text-zinc-500 italic">
        Screen Text — not used. This scenario uses scenario-level{' '}
        <span className="font-mono not-italic">setup_text</span> (edit at
        the top of this builder).
      </div>
    );
  }

  const save = () => {
    startTransition(async () => {
      await adminUpdateScreenText(screen.dbId, text);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-zinc-700">
            Screen Text
          </label>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
        </div>
        <p className="text-sm text-zinc-600 whitespace-pre-line">
          {screen.text ?? ''}
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium text-zinc-700 block mb-1">
        Screen Text
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={save}
          disabled={pending}
          className="px-3 py-1 bg-zinc-900 text-white rounded text-xs font-medium disabled:bg-zinc-400"
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => {
            setText(screen.text ?? '');
            setEditing(false);
          }}
          className="px-3 py-1 border border-zinc-300 rounded text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Prompt editor
// ============================================================

function PromptEditor({ screen }: { screen: ScenarioScreen }) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(screen.prompt);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      await adminUpdateScreenPrompt(screen.dbId, prompt);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-700">
          Prompt: {screen.prompt || <span className="text-zinc-400 italic">none</span>}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium text-zinc-700 block mb-1">
        Prompt (shown below scenario text)
      </label>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. What is your immediate reaction?"
        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={save}
          disabled={pending}
          className="px-3 py-1 bg-zinc-900 text-white rounded text-xs font-medium disabled:bg-zinc-400"
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => {
            setPrompt(screen.prompt);
            setEditing(false);
          }}
          className="px-3 py-1 border border-zinc-300 rounded text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Timer editor
// ============================================================

function TimerEditor({ screen }: { screen: ScenarioScreen }) {
  const [editing, setEditing] = useState(false);
  const [seconds, setSeconds] = useState(screen.timerSeconds);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      await adminUpdateScreenTimer(screen.dbId, seconds);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-700">
          Timer: {screen.timerSeconds}s
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-zinc-700">Timer:</label>
      <input
        type="number"
        value={seconds}
        onChange={(e) => setSeconds(parseInt(e.target.value) || 0)}
        min={1}
        className="w-20 px-2 py-1 border border-zinc-300 rounded text-sm"
      />
      <span className="text-sm text-zinc-500">seconds</span>
      <button
        onClick={save}
        disabled={pending}
        className="px-3 py-1 bg-zinc-900 text-white rounded text-xs font-medium disabled:bg-zinc-400"
      >
        {pending ? '...' : 'Save'}
      </button>
      <button
        onClick={() => {
          setSeconds(screen.timerSeconds);
          setEditing(false);
        }}
        className="text-xs text-zinc-500"
      >
        Cancel
      </button>
    </div>
  );
}

// ============================================================
// Option editor
// ============================================================

function OptionEditor({
  option,
  allScreenIds,
}: {
  option: ScenarioOption;
  allScreenIds: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(option.text);
  const [route, setRoute] = useState(option.nextScreenId ?? '');
  const [pending, startTransition] = useTransition();
  const [delPending, startDel] = useTransition();

  const save = () => {
    startTransition(async () => {
      await adminUpdateOptionText(option.id, text);
      await adminUpdateOptionRoute(option.id, route || null);
      setEditing(false);
    });
  };

  return (
    <div className="flex items-start gap-2 bg-white rounded-lg p-3 border border-zinc-200">
      <span className="font-mono font-medium text-zinc-500 mt-0.5">
        {option.label}.
      </span>
      {editing ? (
        <div className="flex-1 space-y-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-2 py-1 border border-zinc-300 rounded text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Route to:</label>
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="px-2 py-1 border border-zinc-300 rounded text-xs"
            >
              <option value="">(terminal — end scenario)</option>
              {allScreenIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="px-2 py-1 bg-zinc-900 text-white rounded text-xs disabled:bg-zinc-400"
            >
              {pending ? '...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setText(option.text);
                setRoute(option.nextScreenId ?? '');
                setEditing(false);
              }}
              className="text-xs text-zinc-500"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!confirm('Delete this option?')) return;
                startDel(() => adminDeleteOption(option.id));
              }}
              disabled={delPending}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 ml-auto"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-700">{option.text}</span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {option.nextScreenId ? (
                <span className="text-xs text-zinc-400 font-mono">
                  \u2192 {option.nextScreenId}
                </span>
              ) : (
                <span className="text-xs text-zinc-400">(terminal)</span>
              )}
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Edit
              </button>
            </div>
          </div>
          {/* Phase 1 Freeze: per-option marker grid */}
          <OptionMarkerEditor option={option} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Per-option marker editor \u2014 8 doctrine markers
// ============================================================
//
// One checkbox per locked marker. Each change calls
// adminUpdateScreenOptionMarkers with the full merged object so the column
// always reflects the explicit truth set (omitted keys default to false at
// query time via `?? false`).
function OptionMarkerEditor({ option }: { option: ScenarioOption }) {
  const initialMarkers = () =>
    Object.fromEntries(
      MARKER_KEYS.map((k) => [k, !!option.triggersMarkers?.[k]]),
    ) as Record<string, boolean>;
  const [markers, setMarkers] = useState<Record<string, boolean>>(
    initialMarkers,
  );
  // Ref mirrors the latest committed markers so rapid double-clicks stay
  // race-safe WITHOUT putting side effects inside the setState updater
  // (illegal in React 19 — updaters must be pure).
  const markersRef = useRef(markers);
  const [pending, startTransition] = useTransition();

  const toggle = (key: MarkerKey) => {
    const next = { ...markersRef.current, [key]: !markersRef.current[key] };
    markersRef.current = next;
    setMarkers(next);
    startTransition(async () => {
      try {
        await adminUpdateScreenOptionMarkers(option.id, next);
      } catch (e) {
        console.error('Marker save failed', e);
      }
    });
  };

  return (
    <div className="mt-1 p-2 bg-zinc-50 border border-zinc-200 rounded">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
          Markers
        </span>
        {pending && <span className="text-[10px] text-zinc-400">Saving\u2026</span>}
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
  );
}

// ============================================================
// Add screen form
// ============================================================

function AddScreenForm({
  scenarioFk,
  nextSortOrder,
  onDone,
  hideTimer,
}: {
  scenarioFk: string;
  nextSortOrder: number;
  onDone: () => void;
  hideTimer: boolean;
}) {
  const [screenId, setScreenId] = useState('');
  const [text, setText] = useState('');
  const [timer, setTimer] = useState(30);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!screenId || !text) return;
    startTransition(async () => {
      await adminAddScreen(scenarioFk, screenId, text, timer, nextSortOrder);
      onDone();
    });
  };

  return (
    <div className="border border-zinc-200 rounded-lg p-4 space-y-3 bg-white">
      <h4 className="text-sm font-medium text-zinc-700">Add New Screen</h4>
      <input
        placeholder="Screen ID (e.g., NEW_SCREEN_1)"
        value={screenId}
        onChange={(e) => setScreenId(e.target.value)}
        className="w-full px-3 py-2 border border-zinc-300 rounded text-sm"
      />
      <textarea
        placeholder="Screen text..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border border-zinc-300 rounded text-sm"
      />
      {!hideTimer && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-600">Timer:</label>
          <input
            type="number"
            value={timer}
            onChange={(e) => setTimer(parseInt(e.target.value) || 30)}
            min={1}
            className="w-20 px-2 py-1 border border-zinc-300 rounded text-sm"
          />
          <span className="text-sm text-zinc-500">seconds</span>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending || !screenId || !text}
          className="px-4 py-2 bg-zinc-900 text-white rounded text-sm font-medium disabled:bg-zinc-300"
        >
          {pending ? 'Adding...' : 'Add Screen'}
        </button>
        <button
          onClick={onDone}
          className="px-4 py-2 border border-zinc-300 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Add option form
// ============================================================

function AddOptionForm({
  screenFk,
  nextSortOrder,
}: {
  screenFk: string;
  nextSortOrder: number;
}) {
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [route, setRoute] = useState('');
  const [pending, startTransition] = useTransition();

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-xs text-blue-600 hover:text-blue-700"
      >
        + Add Option
      </button>
    );
  }

  const submit = () => {
    if (!label || !text) return;
    startTransition(async () => {
      await adminAddOption(
        screenFk,
        label,
        text,
        route || null,
        nextSortOrder,
      );
      setLabel('');
      setText('');
      setRoute('');
      setShow(false);
    });
  };

  return (
    <div className="bg-white border border-zinc-200 rounded p-3 space-y-2">
      <div className="flex gap-2">
        <input
          placeholder="Label (A,B...)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-24 px-2 py-1 border border-zinc-300 rounded text-sm"
        />
        <input
          placeholder="Option text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 px-2 py-1 border border-zinc-300 rounded text-sm"
        />
      </div>
      <input
        placeholder="Route to screen ID (leave empty for terminal)"
        value={route}
        onChange={(e) => setRoute(e.target.value)}
        className="w-full px-2 py-1 border border-zinc-300 rounded text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending || !label || !text}
          className="px-3 py-1 bg-zinc-900 text-white rounded text-xs disabled:bg-zinc-300"
        >
          {pending ? '...' : 'Add'}
        </button>
        <button onClick={() => setShow(false)} className="text-xs text-zinc-500">
          Cancel
        </button>
      </div>
    </div>
  );
}
