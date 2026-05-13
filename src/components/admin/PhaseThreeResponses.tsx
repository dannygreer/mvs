// Group Phase 3 responses_wide rows by student so the 6 assessments
// (MC test bank + 5 video scenarios) that a student takes back-to-back
// in the certification battery render as one card per student instead
// of 6 scattered rows. Falls back to participant_id when student_id is
// null (older walk-in responses pre-auth).
import type { ResponseWideRow } from '@/types';
import { PHASE_META } from '@/lib/phases';

interface Props {
  responses: ResponseWideRow[];
}

interface StudentBundle {
  key: string;
  name: string;
  byCode: Map<string, ResponseWideRow>;
  latestCompletedAt: string;
}

export default function PhaseThreeResponses({ responses }: Props) {
  if (responses.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500 text-sm">
        No Phase 3 certification responses yet.
      </div>
    );
  }

  const bundles = groupByStudent(responses);
  const phase3Codes = PHASE_META.phase_3.assessmentCodes;

  return (
    <div className="p-4 space-y-4">
      <p className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {bundles.length} student{bundles.length === 1 ? '' : 's'} ·{' '}
        {responses.length} total responses
      </p>
      {bundles.map((b) => (
        <div
          key={b.key}
          className="border border-zinc-200 rounded-lg overflow-hidden"
        >
          <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <p className="font-medium text-zinc-900">{b.name}</p>
            <p className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500">
              latest {formatDate(b.latestCompletedAt)}
            </p>
          </div>
          <ul className="divide-y divide-zinc-100">
            {phase3Codes.map((code) => {
              const r = b.byCode.get(code);
              return (
                <li
                  key={code}
                  className="px-4 py-2 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-mono text-xs text-zinc-700">
                    {code}
                  </span>
                  {r ? (
                    <span className="text-zinc-600">
                      path{' '}
                      <span className="font-mono text-xs text-zinc-700">
                        {r.branch_path || '—'}
                      </span>{' '}
                      · {Math.round(r.total_time / 1000)}s
                    </span>
                  ) : (
                    <span className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-400">
                      not completed
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function groupByStudent(rows: ResponseWideRow[]): StudentBundle[] {
  const map = new Map<string, StudentBundle>();
  for (const r of rows) {
    const key = r.student_id ?? r.participant_id;
    const name =
      [r.first_name, r.last_name].filter(Boolean).join(' ').trim() ||
      r.participant_id;
    let b = map.get(key);
    if (!b) {
      b = {
        key,
        name,
        byCode: new Map(),
        latestCompletedAt: r.completed_at,
      };
      map.set(key, b);
    }
    b.byCode.set(r.scenario_id, r);
    if (r.completed_at > b.latestCompletedAt) {
      b.latestCompletedAt = r.completed_at;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.latestCompletedAt < b.latestCompletedAt ? 1 : -1,
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
