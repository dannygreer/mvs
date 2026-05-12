// Admin preview run for a scenario assessment. Identical to the student
// runner — same Quiz component, same timing, same revisable / video /
// setup behavior — except the terminal submission is skipped (previewMode
// gates it inside src/components/quiz/Quiz.tsx). The PreviewBanner stays
// pinned to the top of every screen so the admin can't confuse the run
// with a live submission.
//
// Route: /mvs/admin/preview/scenario/[id]  where [id] = scenarios.id (uuid)
import { notFound } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth';
import { getScenarioById } from '@/lib/db';
import Quiz from '@/components/quiz/Quiz';

export const dynamic = 'force-dynamic';

export default async function ScenarioPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const scenario = await getScenarioById(id);
  if (!scenario) notFound();

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-white">
      <Quiz
        scenario={scenario}
        previewMode
        prefillFirstName="Admin"
        prefillLastName="Preview"
        prefillPhase="practice"
      />
    </div>
  );
}
