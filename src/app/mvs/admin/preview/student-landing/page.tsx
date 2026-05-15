// Admin preview of the student session-day landing. A top-right switch
// toggles between PREVIEW VIEW (all phases active, buttons deep-link
// into the admin preview runs) and STUDENT VIEW (exact student gating —
// Phase 1 active, 2 & 3 locked). No real student / enrollment involved;
// nothing is recorded.
//
// Route: /mvs/admin/preview/student-landing
import { requireSuperAdmin } from '@/lib/auth';
import { getScenarioByCode, listAssessmentsByCodes } from '@/lib/db';
import { PHASE_META } from '@/lib/phases';
import StudentLandingPreviewToggle from '@/components/admin/StudentLandingPreviewToggle';
import PreviewFloatingNotice from '@/components/admin/PreviewFloatingNotice';

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

  return (
    <>
      <StudentLandingPreviewToggle
        scenarioHref={scenarioHref}
        phase3Href={phase3Href}
      />
      <PreviewFloatingNotice />
    </>
  );
}
