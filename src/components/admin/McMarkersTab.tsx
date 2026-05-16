'use client';

// Phase 3 written-test editor. Each question card lets the doctor:
//   - Edit the question prompt (textarea, save on blur)
//   - Edit each option's text (input, save on blur)
//   - Pick which option is correct (radio, immediate save)
//   - Toggle the 8 doctrine markers per option (existing checkbox grid)
//
// Defensive note: the loader (loadMcQuestionsForAdmin) does return
// is_correct because admins need to see the answer key while editing.
// The data flows through here as Server Component → Client Component
// props (this file is 'use client'); never propagate it into a
// student-facing route.

import { useState, useTransition } from 'react';
import {
  adminUpdateMcOptionMarkers,
  adminUpdateMcOptionDoctrine,
  adminUpdateMcQuestionPrompt,
  adminUpdateMcOptionText,
  adminSetMcCorrectOption,
} from '@/actions/admin';
import type { McAdminAssessment, McAdminQuestion } from '@/lib/db';
import MarkerWeightGrid from './MarkerWeightGrid';

// Marker keys/labels/weights now live in MarkerWeightGrid (shared with
// ScenarioBuilderTab — single source of truth post Phase A).

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
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900">Test Bank Editor</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Edit each question prompt, option text, the correct answer, and
            the 8 doctrine markers per option. Changes save on blur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {assessments.length > 1 && (
            <span className="text-xs text-zinc-500 mvs-mono">
              {assessments.find((a) => a.id === activeAssessmentId)?.code ?? '—'}
            </span>
          )}
          {activeAssessmentId && (
            <a
              href={`/mvs/admin/preview/test-bank/${activeAssessmentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mvs-mono inline-flex items-center gap-1 px-3 py-1.5 border border-zinc-300 text-[10px] uppercase tracking-widest text-zinc-700 hover:bg-white transition-colors"
              title="Walk through the exam as a student — no data is recorded"
            >
              Preview ↗
            </a>
          )}
        </div>
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
      <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 space-y-2">
        <p className="text-xs text-zinc-500 font-mono">Q{question.sequence}</p>
        <PromptEditor questionId={question.id} initial={question.prompt} />
      </div>
      <div className="divide-y divide-zinc-100">
        {question.options.map((o) => (
          <McOptionRow
            key={o.id}
            questionId={question.id}
            optionId={o.id}
            label={o.label}
            initialText={o.text}
            initialCorrect={o.isCorrect}
            initialMarkers={o.triggersMarkers}
            initialClassification={o.optionClassification}
            initialRationale={o.rationale}
          />
        ))}
      </div>
    </li>
  );
}

function PromptEditor({
  questionId,
  initial,
}: {
  questionId: string;
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = () => {
    const trimmed = text.trim();
    if (trimmed === initial.trim()) return;
    startTransition(async () => {
      try {
        await adminUpdateMcQuestionPrompt(questionId, trimmed);
        setSavedAt(Date.now());
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Save failed';
        window.alert(msg);
      }
    });
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={2}
        className="w-full px-3 py-2 text-sm text-zinc-900 border border-zinc-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
      />
      <div className="text-[10px] text-zinc-400 mt-1 h-3">
        {pending
          ? 'Saving…'
          : savedAt
          ? 'Saved'
          : ''}
      </div>
    </div>
  );
}

function McOptionRow({
  questionId,
  optionId,
  label,
  initialText,
  initialCorrect,
  initialMarkers,
  initialClassification,
  initialRationale,
}: {
  questionId: string;
  optionId: string;
  label: 'A' | 'B' | 'C' | 'D';
  initialText: string;
  initialCorrect: boolean;
  initialMarkers: Record<string, number>;
  initialClassification: string | null;
  initialRationale: string | null;
}) {
  const [text, setText] = useState(initialText);
  const [isCorrect, setIsCorrect] = useState(initialCorrect);
  const [pending, startTransition] = useTransition();

  const saveText = () => {
    const trimmed = text.trim();
    if (trimmed === initialText.trim()) return;
    startTransition(async () => {
      try {
        await adminUpdateMcOptionText(optionId, trimmed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Save failed';
        window.alert(msg);
      }
    });
  };

  const setCorrect = () => {
    if (isCorrect) return;
    setIsCorrect(true); // optimistic
    startTransition(async () => {
      try {
        await adminSetMcCorrectOption(questionId, optionId);
      } catch (e) {
        setIsCorrect(false); // rollback
        const msg = e instanceof Error ? e.message : 'Save failed';
        window.alert(msg);
      }
    });
  };

  return (
    <div
      className={`px-4 py-3 flex flex-col md:flex-row md:items-start gap-3 ${
        isCorrect ? 'bg-emerald-50/40' : ''
      }`}
    >
      <div className="md:w-1/3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-700 text-sm">{label}.</span>
          <label className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest cursor-pointer">
            <input
              type="radio"
              name={`correct-${questionId}`}
              checked={isCorrect}
              onChange={setCorrect}
              disabled={pending}
            />
            <span
              className={
                isCorrect ? 'text-emerald-700 font-semibold' : 'text-zinc-500'
              }
            >
              Correct
            </span>
          </label>
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={saveText}
          className="w-full px-2 py-1 text-sm text-zinc-800 border border-zinc-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
      </div>
      <div className="md:flex-1">
        <MarkerWeightGrid
          initialMarkers={initialMarkers}
          initialClassification={initialClassification}
          initialRationale={initialRationale}
          saveMarkers={(m) => adminUpdateMcOptionMarkers(optionId, m)}
          saveDoctrine={(patch) => adminUpdateMcOptionDoctrine(optionId, patch)}
        />
      </div>
    </div>
  );
}
