import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth';
import {
  getScenarioById,
  listAssessmentsByCodes,
  loadMcQuestionsForAdmin,
  type PhaseAssessmentRow,
} from '@/lib/db';
import { loadDashboardSnapshot } from '@/lib/dashboard';
import { PHASE_META } from '@/lib/phases';
import AdminHeader from '@/components/admin/AdminHeader';
import ScenarioBuilderTab from '@/components/admin/ScenarioBuilderTab';
import McMarkersTab from '@/components/admin/McMarkersTab';
import CertificationCharts from '@/components/admin/charts/CertificationCharts';

export const dynamic = 'force-dynamic';

interface PageProps {
  // Next 16 — searchParams is a Promise.
  searchParams: Promise<{ assessment?: string }>;
}

export default async function AdminPhase3Page({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const { assessment: requestedCode } = await searchParams;

  const meta = PHASE_META.phase_3;
  const [assessments, snapshot] = await Promise.all([
    listAssessmentsByCodes(meta.assessmentCodes),
    loadDashboardSnapshot(),
  ]);

  const active: PhaseAssessmentRow | null =
    assessments.find((a) => a.code === requestedCode) ??
    assessments[0] ??
    null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminHeader
        title={meta.label}
        subtitle={meta.description}
        activeRoute="/mvs/admin/phase-3"
      />
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <h2 className="mvs-display text-3xl font-bold text-zinc-900">
          {meta.shortLabel}: {meta.name}
        </h2>
        {assessments.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No Phase 3 assessments configured.
          </p>
        ) : (
          <>
            <SubTabStrip assessments={assessments} activeCode={active?.code} />
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              {active ? <AssessmentEditor row={active} /> : null}
            </div>
            <section className="bg-white border border-zinc-200 rounded-xl p-4">
              <h2 className="mvs-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-900 mb-3">
                Certification Outcomes
              </h2>
              <CertificationCharts certification={snapshot.certification} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function SubTabStrip({
  assessments,
  activeCode,
}: {
  assessments: PhaseAssessmentRow[];
  activeCode: string | undefined;
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto bg-white border border-zinc-200 rounded-xl p-1">
      {assessments.map((a) => {
        const active = a.code === activeCode;
        return (
          <Link
            key={a.code}
            href={`/mvs/admin/phase-3?assessment=${a.code}`}
            className={`mvs-mono px-3 py-2 text-[10px] uppercase tracking-widest whitespace-nowrap rounded-md transition-colors ${
              active
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
            title={a.name}
          >
            {a.code}
          </Link>
        );
      })}
    </nav>
  );
}

async function AssessmentEditor({ row }: { row: PhaseAssessmentRow }) {
  if (row.kind === 'multi_choice') {
    const questions = await loadMcQuestionsForAdmin(row.id);
    return (
      <McMarkersTab
        assessments={[{ id: row.id, code: row.code, name: row.name }]}
        questions={questions}
        activeAssessmentId={row.id}
      />
    );
  }
  // kind === 'scenario'
  if (!row.scenario_fk) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Assessment {row.code} has no linked scenario.
      </div>
    );
  }
  const scenario = await getScenarioById(row.scenario_fk);
  const list = scenario
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
  return <ScenarioBuilderTab scenario={scenario} scenarios={list} />;
}
