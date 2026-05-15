import { requireStudent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PHASE_META } from '@/lib/phases';
import PhaseLanding, {
  type PhaseConfig,
} from '@/components/student/PhaseLanding';

export const dynamic = 'force-dynamic';

type EnrollmentRow = {
  id: string;
  phase: 'pre' | 'post' | 'practice';
  completed_at: string | null;
  assessments: { code: string } | null;
};

export default async function StudentHome() {
  const { profile } = await requireStudent('/app');
  const supabase = await createClient();

  const { data } = await supabase
    .from('enrollments')
    .select('id, phase, completed_at, assessments(code)');

  const rows = (data ?? []) as unknown as EnrollmentRow[];

  // Phase 1 = active_threat pre. Phase 2 = active_threat post.
  // Phase 3 = any of the 6 phase-3 codes (all phase='post').
  const phase1 = rows.find(
    (r) => r.assessments?.code === 'active_threat_v1' && r.phase === 'pre',
  );
  const phase2 = rows.find(
    (r) => r.assessments?.code === 'active_threat_v1' && r.phase === 'post',
  );
  const phase3Rows = rows.filter(
    (r) =>
      r.assessments?.code != null &&
      PHASE_META.phase_3.assessmentCodes.includes(r.assessments.code) &&
      r.phase === 'post',
  );

  const phase1Done = !!phase1?.completed_at;
  const phase2Done = !!phase2?.completed_at;
  const phase3Done =
    phase3Rows.length > 0 && phase3Rows.every((r) => r.completed_at != null);

  const phases: PhaseConfig[] = [
    {
      number: 1,
      title: PHASE_META.phase_1.name,
      description:
        'Baseline measurement before training. Quick branching scenario.',
      state: phase1 ? (phase1Done ? 'done' : 'active') : 'missing',
      href: phase1 ? `/app/take/${phase1.id}` : null,
    },
    {
      number: 2,
      title: PHASE_META.phase_2.name,
      description:
        'Retake the same scenario at the end of the day. We measure how your decisions changed.',
      state: phase2
        ? phase2Done
          ? 'done'
          : phase1Done
          ? 'active'
          : 'locked'
        : 'missing',
      href: phase2 ? `/app/take/${phase2.id}` : null,
    },
    {
      number: 3,
      title: PHASE_META.phase_3.name,
      description:
        'End-of-day certification: written test + five video scenarios. Each one starts automatically when the previous finishes.',
      state:
        phase3Rows.length === 0
          ? 'missing'
          : phase3Done
          ? 'done'
          : phase2Done
          ? 'active'
          : 'locked',
      href: '/app/phase-3/next',
    },
  ];

  return (
    <PhaseLanding
      eyebrow="Session day"
      heading={`Hi, ${profile.full_name?.split(' ')[0] || 'Welcome'}.`}
      intro="Three phases today. Complete each one in order — the next phase unlocks when you finish the previous."
      phases={phases}
    />
  );
}
