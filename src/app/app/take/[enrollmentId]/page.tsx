import { redirect, notFound } from 'next/navigation';
import { requireStudent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getScenarioById } from '@/lib/db';
import Quiz from '@/components/quiz/Quiz';

export const dynamic = 'force-dynamic';

type EnrollmentDetail = {
  id: string;
  student_id: string;
  phase: 'pre' | 'post' | 'practice';
  completed_at: string | null;
  assessments: {
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
      'id, student_id, phase, completed_at, assessments(code, name, kind, scenario_fk)'
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

  if (assessment.kind === 'multi_choice') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">
        <p className="text-zinc-700">
          The multi-choice runner ships next. Check back soon.
        </p>
        <p className="text-xs text-zinc-400 mt-2">[NEEDS_DAY_5]</p>
      </div>
    );
  }

  if (!assessment.scenario_fk) notFound();
  const scenario = await getScenarioById(assessment.scenario_fk);
  if (!scenario) notFound();

  const fullName = profile.full_name ?? '';
  const [first, ...rest] = fullName.split(' ');
  const last = rest.join(' ') || first || 'Student';

  return (
    <div className="flex flex-col flex-1 min-h-[80vh] bg-white">
      <Quiz
        scenario={scenario}
        enrollmentId={enrollment.id}
        studentId={user.id}
        prefillFirstName={first || 'Student'}
        prefillLastName={last}
        prefillPhase={enrollment.phase as 'pre' | 'post' | 'practice'}
      />
    </div>
  );
}
