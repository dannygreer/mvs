// Admin preview run for an MC assessment (the 50-question test bank).
// Uses loadMcQuestionsForStudent (NOT the admin loader) so the answer
// key never crosses the wire — the preview wire payload is identical to
// what a real student would receive.
//
// Route: /mvs/admin/preview/test-bank/[id]  where [id] = assessments.id (uuid)
import { notFound } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth';
import { loadMcQuestionsForStudent } from '@/lib/db';
import McQuiz from '@/components/quiz/McQuiz';

export const dynamic = 'force-dynamic';

export default async function TestBankPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const questions = await loadMcQuestionsForStudent(id);
  if (questions.length === 0) notFound();

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-zinc-950">
      <McQuiz questions={questions} previewMode />
    </div>
  );
}
