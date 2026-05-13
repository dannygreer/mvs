import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth';
import {
  getScenarioById,
  listAssessmentsByCodes,
  loadMcQuestionsForAdmin,
  getResponsesByCodes,
  type PhaseAssessmentRow,
} from '@/lib/db';
import { loadDashboardSnapshot } from '@/lib/dashboard';
import { PHASE_META } from '@/lib/phases';
import AdminHeader from '@/components/admin/AdminHeader';
import ScenarioBuilderTab from '@/components/admin/ScenarioBuilderTab';
import McMarkersTab from '@/components/admin/McMarkersTab';
import CertificationCharts from '@/components/admin/charts/CertificationCharts';
import PhaseSubNav from '@/components/admin/PhaseSubNav';
import PhaseThreeResponses from '@/components/admin/PhaseThreeResponses';

export const dynamic = 'force-dynamic';

interface PageProps {
  // Next 16 — searchParams is a Promise.
  searchParams: Promise<{ assessment?: string; view?: string }>;
}

export default async function AdminPhase3Page({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const { assessment: requestedCode, view: rawView } = await searchParams;
  const view = rawView === 'responses' ? 'responses' : 'editor';

  const meta = PHASE_META.phase_3;
  const [assessments, snapshot, responses] = await Promise.all([
    listAssessmentsByCodes(meta.assessmentCodes),
    loadDashboardSnapshot(),
    getResponsesByCodes(meta.assessmentCodes, 'post'),
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

        <PhaseSubNav
          basePath="/mvs/admin/phase-3"
          active={view}
          responsesCount={responses.length}
          editorLabel="Editor + Outcomes"
          extraQuery={
            view === 'editor' ? { assessment: active?.code } : undefined
          }
        />

        {assessments.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No Phase 3 assessments configured.
          </p>
        ) : view === 'responses' ? (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <PhaseThreeResponses responses={responses} />
          </div>
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

// Friendly button labels for the Phase 3 sub-tab strip. Keyed by the
// assessment.code in PHASE_META.phase_3.assessmentCodes; falls back to
// assessment.name then code if a new code is added.
const PHASE_3_TAB_LABELS: Record<string, string> = {
  mvs_test_bank_v1: 'Written Test',
  scenario_conversation_velocity_v1: 'Scenario: Conversation Velocity',
  scenario_perception_narrowing_v1: 'Scenario: Perception Narrowing',
  scenario_escalation_loop_v1: 'Scenario: Escalation Loop',
  scenario_team_velocity_v1: 'Scenario: Team Velocity',
  scenario_recovery_drift_v1: 'Scenario: Recovery Drift',
};

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
        const label = PHASE_3_TAB_LABELS[a.code] ?? a.name ?? a.code;
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
            {label}
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
      <details className="group">
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
          <div>
            <p className="font-semibold text-zinc-900">{row.name}</p>
            <p className="text-sm text-zinc-500 mt-0.5">
              {questions.length} questions · click to expand the marker editor
            </p>
          </div>
          <span className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 group-open:hidden">
            Expand ▸
          </span>
          <span className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 hidden group-open:inline">
            Collapse ▾
          </span>
        </summary>
        <McMarkersTab
          assessments={[{ id: row.id, code: row.code, name: row.name }]}
          questions={questions}
          activeAssessmentId={row.id}
        />
      </details>
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
