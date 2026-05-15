import { redirect, notFound } from 'next/navigation';
import { requireStudent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getScenarioById, loadMcQuestionsForStudent } from '@/lib/db';
import Quiz from '@/components/quiz/Quiz';
import McQuiz from '@/components/quiz/McQuiz';
import { PHASE_META } from '@/lib/phases';

export const dynamic = 'force-dynamic';

type EnrollmentDetail = {
  id: string;
  student_id: string;
  phase: 'pre' | 'post' | 'practice';
  completed_at: string | null;
  assessments: {
    id: string;
    code: string;
    name: string;
    kind: 'scenario' | 'multi_choice';
    scenario_fk: string | null;
  } | null;
};

export default async function TakeAssessmentPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;
  const { user, profile } = await requireStudent(`/app/take/${enrollmentId}`);

  // Authenticated client — RLS guarantees the student can only read their own
  // enrollment. If wrong student or non-existent, this returns no row.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      'id, student_id, phase, completed_at, assessments(id, code, name, kind, scenario_fk)'
    )
    .eq('id', enrollmentId)
    .single();

  if (error || !data) notFound();
  const enrollment = data as unknown as EnrollmentDetail;

  // Defense in depth — RLS already enforces this, but assert.
  if (enrollment.student_id !== user.id) notFound();

  if (enrollment.completed_at) {
    redirect('/app?notice=already_completed');
  }

  const assessment = enrollment.assessments;
  if (!assessment) notFound();

  const fullName = profile.full_name ?? '';
  const [first, ...rest] = fullName.split(' ');
  const last = rest.join(' ') || first || 'Student';
  const participantId = `${(first || 'student').toLowerCase()}_${(last || 'na').toLowerCase()}_${Date.now()}`;

  // Phase 3 sub-assessments chain through /app/phase-3/next so the
  // battery auto-progresses to the next incomplete sub. Everything
  // else (Phase 1 pre, Phase 2 post) returns to /app.
  const isPhase3 = PHASE_META.phase_3.assessmentCodes.includes(
    assessment.code,
  );
  const nextHref = isPhase3 ? '/app/phase-3/next' : '/app';

  if (assessment.kind === 'multi_choice') {
    const questions = await loadMcQuestionsForStudent(assessment.id);
    return (
      <div className="flex flex-col flex-1 min-h-[80vh] bg-zinc-950">
        <McQuiz
          questions={questions}
          enrollmentId={enrollment.id}
          studentId={user.id}
          phase={enrollment.phase}
          assessmentCode={assessment.code}
          participantId={participantId}
          nextHref={nextHref}
        />
      </div>
    );
  }

  if (assessment.kind === 'scenario') {
    if (!assessment.scenario_fk) notFound();
    const scenario = await getScenarioById(assessment.scenario_fk);
    if (!scenario) notFound();

    return (
      <div className="flex flex-col flex-1 min-h-[80vh] bg-zinc-950">
        <Quiz
          scenario={scenario}
          enrollmentId={enrollment.id}
          studentId={user.id}
          prefillFirstName={first || 'Student'}
          prefillLastName={last}
          prefillPhase={enrollment.phase}
          nextHref={nextHref}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-center">
      <p className="text-zinc-700">Unsupported assessment type.</p>
    </div>
  );
}
