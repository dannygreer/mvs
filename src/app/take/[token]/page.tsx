import { notFound } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getScenarioById, loadMcQuestionsForStudent } from '@/lib/db';
import Quiz from '@/components/quiz/Quiz';
import McQuiz from '@/components/quiz/McQuiz';
import type { Phase } from '@/types';

export const dynamic = 'force-dynamic';

// Token-based assessment delivery. No authentication required — the URL
// itself is the auth, and the secret_token on the enrollment row scopes the
// session to one student × one assessment × one phase.
//
// Designed for the in-room training context: facilitator generates and
// distributes URLs at session start (printed handouts, projector, Slack).
// Each URL is single-use (enrollment.completed_at is set on submit and the
// page renders an "already submitted" state on revisit).

function adminClient() {
  return createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type EnrollmentRow = {
  id: string;
  student_id: string;
  phase: Phase;
  completed_at: string | null;
  assessments: {
    id: string;
    code: string;
    name: string;
    kind: 'scenario' | 'multi_choice';
    scenario_fk: string | null;
  } | null;
  profiles: { full_name: string | null } | null;
};

export default async function TakeByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = adminClient();
  const { data, error } = await admin
    .from('enrollments')
    .select(
      `id, student_id, phase, completed_at,
       assessments(id, code, name, kind, scenario_fk),
       profiles(full_name)`
    )
    .eq('secret_token', token)
    .single();

  if (error || !data) notFound();
  const enrollment = data as unknown as EnrollmentRow;

  if (enrollment.completed_at) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 px-6">
        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-3">
          <h1 className="text-2xl font-bold text-zinc-900">Already submitted</h1>
          <p className="text-zinc-600">
            This assessment has already been completed. Thanks for participating.
          </p>
          <p className="text-xs text-zinc-400">
            If this is a mistake, ask your facilitator to issue a new link.
          </p>
        </div>
      </div>
    );
  }

  const a = enrollment.assessments;
  if (!a) notFound();

  const fullName = enrollment.profiles?.full_name ?? '';
  const [first, ...rest] = fullName.split(' ');
  const last = rest.join(' ') || first || 'Student';

  if (a.kind === 'multi_choice') {
    const questions = await loadMcQuestionsForStudent(a.id);
    return (
      <div className="flex flex-col flex-1 min-h-screen bg-zinc-950">
        <McQuiz questions={questions} token={token} />
      </div>
    );
  }

  if (a.kind === 'scenario') {
    if (!a.scenario_fk) notFound();
    const scenario = await getScenarioById(a.scenario_fk);
    if (!scenario) notFound();

    return (
      <div className="flex flex-col flex-1 min-h-screen bg-white">
        <Quiz
          scenario={scenario}
          token={token}
          prefillFirstName={first || 'Student'}
          prefillLastName={last}
          prefillPhase={enrollment.phase}
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
