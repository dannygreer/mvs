import { requireSuperAdmin } from '@/lib/auth';
import { getScenarioByCode, getResponsesByCodes } from '@/lib/db';
import { loadDashboardSnapshot } from '@/lib/dashboard';
import { PHASE_META } from '@/lib/phases';
import AdminHeader from '@/components/admin/AdminHeader';
import Phase1To2Delta from '@/components/admin/charts/Phase1To2Delta';
import ResponsesTab from '@/components/admin/ResponsesTab';
import PhaseSubNav from '@/components/admin/PhaseSubNav';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function AdminPhase2Page({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const { view: rawView } = await searchParams;
  const view = rawView === 'responses' ? 'responses' : 'editor';

  const meta = PHASE_META.phase_2;
  const scenarioCode = meta.assessmentCodes[0]; // active_threat_v1
  const [scenario, snapshot, responses] = await Promise.all([
    getScenarioByCode(scenarioCode),
    loadDashboardSnapshot(),
    getResponsesByCodes([scenarioCode], 'post'),
  ]);

  const screens = scenario
    ? Object.values(scenario.screens).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      )
    : [];

  const postCompletion = snapshot.completion.find(
    (r) => r.assessment_code === scenarioCode && r.phase === 'post',
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminHeader
        title={meta.label}
        subtitle={meta.description}
        activeRoute="/mvs/admin/phase-2"
      />
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <h2 className="mvs-display text-3xl font-bold text-zinc-900">
          {meta.shortLabel}: {meta.name}
        </h2>

        <PhaseSubNav
          basePath="/mvs/admin/phase-2"
          active={view}
          responsesCount={responses.length}
        />

        {view === 'responses' ? (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <ResponsesTab responses={responses} />
          </div>
        ) : (
          <>
        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <h2 className="mvs-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-900 mb-3">
            Adaptive Performance Analysis · Pre → Post Delta
          </h2>
          <p className="text-sm text-zinc-500 mb-4">
            Post completion: {postCompletion?.completed ?? 0} of{' '}
            {postCompletion?.enrolled ?? 0} students.
          </p>
          <Phase1To2Delta
            pairs={snapshot.activeThreatPairs}
            markers={snapshot.markers}
          />
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="mvs-mono text-[11px] uppercase tracking-widest text-amber-800">
            Read-only — scenario shared with Phase 1
          </p>
          <p className="text-sm text-amber-900 mt-1">
            Phase 2 measures students taking the same scenario at the end of
            the session day. Edit the scenario content under{' '}
            <a href="/mvs/admin/phase-1" className="underline">
              Phase 1
            </a>
            .
          </p>
        </section>

        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="mvs-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-900">
                Scenario Summary
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                {scenario
                  ? `${scenario.title} · ${screens.length} screens · entry ${scenario.entryScreenId}`
                  : 'No scenario loaded.'}
              </p>
            </div>
            {scenario && (
              <a
                href={`/mvs/admin/preview/scenario/${scenario.dbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mvs-mono inline-flex items-center gap-1 px-3 py-1.5 border border-zinc-300 text-[10px] uppercase tracking-widest text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Preview ↗
              </a>
            )}
          </div>
          {screens.length > 0 && (
            <ul className="mt-3 divide-y divide-zinc-100 border border-zinc-100 rounded-lg">
              {screens.map((s) => (
                <li
                  key={s.dbId}
                  className="px-3 py-2 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-mono text-zinc-700">{s.id}</span>
                  <span className="text-zinc-500 text-xs">
                    {s.options.length} options · {s.timerSeconds}s
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
          </>
        )}
      </main>
    </div>
  );
}
