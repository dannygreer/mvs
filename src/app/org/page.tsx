import { requireOrgAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  getOrg,
  listEnrollmentScoresForCurrentOrg,
  listOrgRollupForCurrentOrg,
  type EnrollmentScoreRow,
  type OrgRollupRow,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

function formatTimeMs(ms: number | null): string {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(p: number | null): string {
  if (p == null) return '—';
  return `${Number(p).toFixed(0)}%`;
}

export default async function OrgPortal() {
  const { profile } = await requireOrgAdmin('/org');
  const org = profile.org_id ? await getOrg(profile.org_id) : null;

  // Pull aggregates + per-enrollment scores via the authenticated SSR client.
  // RLS scopes both views to this admin's org automatically.
  const [rollup, scores] = await Promise.all([
    listOrgRollupForCurrentOrg(),
    listEnrollmentScoresForCurrentOrg(),
  ]);

  // Group enrollment scores by student for the roster view.
  const supabase = await createClient();
  const studentIds = Array.from(new Set(scores.map((s) => s.student_id)));
  let students: { id: string; full_name: string | null }[] = [];
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', studentIds);
    students = (data ?? []) as { id: string; full_name: string | null }[];
  }

  // The org_admin DOES NOT have direct access to auth.users for emails.
  // We could call a server action that uses the service role — but for v1,
  // showing names + per-enrollment scores is enough for the doctor's
  // intended workflow. Skip emails on this surface.

  const studentMap = new Map(
    students.map((s) => [s.id, s.full_name ?? '—'])
  );
  const scoresByStudent = new Map<string, EnrollmentScoreRow[]>();
  for (const s of scores) {
    const arr = scoresByStudent.get(s.student_id) ?? [];
    arr.push(s);
    scoresByStudent.set(s.student_id, arr);
  }

  const totalStudents = scoresByStudent.size;
  const totalEnrollments = scores.length;
  const totalCompleted = scores.filter((s) => s.completed_at).length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {org && (
        <section className="bg-white border border-zinc-200 rounded-xl p-6">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">
            Organization
          </p>
          <h2 className="text-2xl font-bold text-zinc-900 mt-1">{org.name}</h2>
          <p className="text-sm text-zinc-600 mt-1">
            {org.type ?? 'No type set'}
            {org.contact_name && ` · ${org.contact_name}`}
            {org.contact_email && ` · ${org.contact_email}`}
          </p>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Snapshot
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <Card label="Students" value={totalStudents} />
          <Card label="Enrollments" value={totalEnrollments} />
          <Card label="Completed" value={totalCompleted} />
        </div>
      </section>

      {rollup.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            Performance by assessment
          </h2>
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Assessment</th>
                  <th className="text-left px-4 py-2 font-medium">Phase</th>
                  <th className="text-right px-4 py-2 font-medium">Enrolled</th>
                  <th className="text-right px-4 py-2 font-medium">Done</th>
                  <th className="text-right px-4 py-2 font-medium">Pass rate</th>
                  <th className="text-right px-4 py-2 font-medium">Avg score</th>
                  <th className="text-right px-4 py-2 font-medium">Avg time</th>
                </tr>
              </thead>
              <tbody>
                {rollup.map((r: OrgRollupRow) => (
                  <tr
                    key={`${r.assessment_id}-${r.phase}`}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-4 py-2 text-zinc-900 font-medium">
                      {r.assessment_code}
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{r.phase}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.enrolled_count}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.completed_count}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.assessment_kind === 'multi_choice' && r.completed_count > 0
                        ? `${Math.round((r.passed_count / r.completed_count) * 100)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPercent(r.avg_score_percent)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatTimeMs(r.avg_total_time_ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Roster
        </h2>
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {totalStudents === 0 ? (
            <p className="px-6 py-12 text-center text-zinc-500 text-sm">
              No students invited yet — your facilitator will invite your team
              and they&apos;ll appear here once they sign in.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Student</th>
                  <th className="text-left px-4 py-2 font-medium">Enrollments</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(scoresByStudent.entries()).map(
                  ([studentId, rows]) => (
                    <tr
                      key={studentId}
                      className="border-b border-zinc-100 last:border-0 align-top"
                    >
                      <td className="px-4 py-3 text-zinc-900 font-medium">
                        {studentMap.get(studentId) ?? '—'}
                      </td>
                      <td className="px-4 py-3 space-y-2">
                        {rows.map((r) => (
                          <div
                            key={r.enrollment_id}
                            className="flex items-center gap-3 text-xs"
                          >
                            <span className="font-mono text-zinc-700">
                              {r.assessment_code}
                            </span>
                            <span className="text-zinc-500">{r.phase}</span>
                            {r.completed_at ? (
                              <>
                                {r.assessment_kind === 'multi_choice' && (
                                  <span
                                    className={`px-2 py-0.5 rounded font-medium ${
                                      r.pass
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {formatPercent(r.score_percent)}
                                    {r.pass ? ' · pass' : ' · fail'}
                                  </span>
                                )}
                                <span className="text-zinc-500">
                                  {formatTimeMs(r.total_time_ms)}
                                </span>
                                <span className="text-zinc-400">
                                  {new Date(r.completed_at).toLocaleDateString()}
                                </span>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">
                                Pending
                              </span>
                            )}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-3xl font-bold text-zinc-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
}
