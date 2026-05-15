// Admin preview of the student session-day landing. Renders the exact
// 3-phase UI a student sees, but with synthetic "all phases active"
// state and the Start buttons deep-linked into the existing admin
// preview routes (no data recorded). No real student / enrollment is
// involved — this is purely a layout + flow walkthrough.
//
// Route: /mvs/admin/preview/student-landing
import { requireSuperAdmin } from '@/lib/auth';
import { getScenarioByCode, listAssessmentsByCodes } from '@/lib/db';
import { PHASE_META } from '@/lib/phases';
import PhaseLanding, {
  type PhaseConfig,
} from '@/components/student/PhaseLanding';

export const dynamic = 'force-dynamic';

export default async function StudentLandingPreviewPage() {
  await requireSuperAdmin();

  // Phase 1 & 2 are the same active_threat scenario; Phase 3's entry
  // point is the MC written test (the rest of the battery is previewable
  // from the Phase 3 admin tab).
  const [scenario, phase3Assessments] = await Promise.all([
    getScenarioByCode('active_threat_v1'),
    listAssessmentsByCodes(PHASE_META.phase_3.assessmentCodes),
  ]);

  const scenarioHref = scenario
    ? `/mvs/admin/preview/scenario/${scenario.dbId}`
    : null;
  const testBank = phase3Assessments.find(
    (a) => a.code === 'mvs_test_bank_v1',
  );
  const phase3Href = testBank
    ? `/mvs/admin/preview/test-bank/${testBank.id}`
    : null;

  const phases: PhaseConfig[] = [
    {
      number: 1,
      title: PHASE_META.phase_1.name,
      description:
        'Baseline measurement before training. Quick branching scenario.',
      state: 'active',
      href: scenarioHref,
    },
    {
      number: 2,
      title: PHASE_META.phase_2.name,
      description:
        'Retake the same scenario at the end of the day. We measure how your decisions changed.',
      state: 'active',
      href: scenarioHref,
    },
    {
      number: 3,
      title: PHASE_META.phase_3.name,
      description:
        'End-of-day certification: written test + five video scenarios. Each one starts automatically when the previous finishes.',
      state: 'active',
      href: phase3Href,
    },
  ];

  const banner = (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <p className="mvs-mono text-[11px] uppercase tracking-widest text-amber-800">
        Admin preview — student session-day landing
      </p>
      <p className="text-sm text-amber-900 mt-1">
        This is exactly what a student sees after logging in, with all
        phases shown active. The Start buttons open the existing admin
        preview runs in a new tab — no responses are recorded. A real
        student sees Phase 2 / 3 locked until the prior phase is
        complete.
      </p>
    </div>
  );

  return (
    <PhaseLanding
      eyebrow="Session day"
      heading="Hi, Student."
      intro="Three phases today. Complete each one in order — the next phase unlocks when you finish the previous."
      phases={phases}
      ctaLabel="Preview →"
      ctaNewTab
      banner={banner}
    />
  );
}
