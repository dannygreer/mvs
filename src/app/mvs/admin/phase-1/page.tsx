import { requireSuperAdmin } from '@/lib/auth';
import { getScenarioByCode } from '@/lib/db';
import { loadDashboardSnapshot } from '@/lib/dashboard';
import { PHASE_META } from '@/lib/phases';
import AdminHeader from '@/components/admin/AdminHeader';
import ScenarioBuilderTab from '@/components/admin/ScenarioBuilderTab';

export const dynamic = 'force-dynamic';

export default async function AdminPhase1Page() {
  await requireSuperAdmin();
  const meta = PHASE_META.phase_1;
  const scenarioCode = meta.assessmentCodes[0]; // active_threat_v1
  const [scenario, snapshot] = await Promise.all([
    getScenarioByCode(scenarioCode),
    loadDashboardSnapshot(),
  ]);

  const preCompletion = snapshot.completion.find(
    (r) => r.assessment_code === scenarioCode && r.phase === 'pre',
  );

  // ScenarioBuilderTab takes a `scenarios` array used for the picker
  // dropdown (rendered only when length > 1). Phase 1 is locked to one
  // scenario, so pass a single-element list — picker stays hidden.
  const scenarioListItem = scenario
    ? [
        {
          id: scenario.dbId,
          scenario_id: scenario.scenarioId,
          version: scenario.version,
          title: scenario.title,
          is_active: true,
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminHeader
        title={meta.label}
        subtitle={meta.description}
        activeRoute="/mvs/admin/phase-1"
      />
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <h2 className="mvs-display text-3xl font-bold text-zinc-900">
          {meta.shortLabel}: {meta.name}
        </h2>
        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <h2 className="mvs-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-900">
            Baseline Stats
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <Stat
              label="Pre completed"
              value={preCompletion?.completed ?? 0}
              sub={`of ${preCompletion?.enrolled ?? 0} enrolled`}
            />
            <Stat
              label="Completion %"
              value={
                preCompletion ? `${Math.round(preCompletion.completion_pct)}%` : '—'
              }
            />
            <Stat label="Scenario" value={scenarioCode} />
          </div>
        </section>

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <ScenarioBuilderTab
            scenario={scenario}
            scenarios={scenarioListItem}
          />
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="border border-zinc-200 rounded-lg p-3">
      <p className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mvs-display text-2xl font-bold text-zinc-900 mt-1">
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}
