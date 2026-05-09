import Link from 'next/link';
import { requireStudent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type EnrollmentRow = {
  id: string;
  phase: 'pre' | 'post' | 'practice';
  completed_at: string | null;
  assigned_at: string;
  due_at: string | null;
  assessments: { code: string; name: string; kind: 'scenario' | 'multi_choice' } | null;
};

export default async function StudentHome() {
  await requireStudent('/app');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('enrollments')
    .select(
      'id, phase, completed_at, assigned_at, due_at, assessments(code, name, kind)'
    )
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('assigned_at', { ascending: false });

  const rows = (data ?? []) as unknown as EnrollmentRow[];
  const assigned = rows.filter((r) => r.completed_at == null);
  const completed = rows.filter((r) => r.completed_at != null);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Failed to load assignments: {error.message}
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Assigned
        </h2>
        {assigned.length === 0 ? (
          <p className="text-sm text-zinc-500 bg-white border border-zinc-200 rounded-xl p-6 text-center">
            Nothing assigned right now. Your facilitator will send you something
            soon.
          </p>
        ) : (
          <ul className="space-y-3">
            {assigned.map((e) => (
              <li
                key={e.id}
                className="bg-white border border-zinc-200 rounded-xl p-5 flex items-center justify-between"
              >
                <div>
                  <p className="text-base font-medium text-zinc-900">
                    {e.assessments?.name ?? 'Assessment'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {e.phase === 'pre'
                      ? 'Pre-training'
                      : e.phase === 'post'
                      ? 'Post-training'
                      : 'Practice'}
                    {e.due_at && (
                      <>
                        {' · '}
                        Due {new Date(e.due_at).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                <Link
                  href={`/app/take/${e.id}`}
                  className="px-5 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
                >
                  Start
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {completed.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            Completed
          </h2>
          <ul className="space-y-2">
            {completed.map((e) => (
              <li
                key={e.id}
                className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-700">
                    {e.assessments?.name ?? 'Assessment'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {e.phase === 'pre'
                      ? 'Pre-training'
                      : e.phase === 'post'
                      ? 'Post-training'
                      : 'Practice'}
                    {e.completed_at && (
                      <>
                        {' · '}
                        Completed{' '}
                        {new Date(e.completed_at).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                  Done
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
