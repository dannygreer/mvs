import PageShell from '@/components/marketing/PageShell';
import SectionFrame from '@/components/marketing/SectionFrame';
import SectionLabel from '@/components/marketing/SectionLabel';
import HudButton from '@/components/marketing/HudButton';
import HudCard from '@/components/marketing/HudCard';

export const metadata = {
  title: 'Certification — MVS',
  description:
    'Maintain MVS certification with ongoing decision-velocity assessments and recertification cycles.',
};

const STEPS = [
  {
    title: 'Baseline pre-assessment',
    body: 'Each enrolled professional completes a scenario-based and 50-question assessment before the in-person training day. Sets the individual baseline.',
  },
  {
    title: 'In-person training day',
    body: 'Doctor-led session covering the doctrine: latency control, sequence integrity, premature commitment, decision accuracy.',
  },
  {
    title: 'Post-assessment + score release',
    body: 'Same instruments, post-training. Pre/post comparison generates the individual MVS Index. 80%+ on the multi-choice section earns certified status.',
  },
  {
    title: 'Recertification cadence',
    body: 'Recertification cycle keeps the standard live.',
  },
];

export default function CertificationPage() {
  return (
    <PageShell
      eyebrow="Certification"
      title="A measurable standard."
      intro="MVS certification is more than a one-time test. It's an ongoing measurement of how decisions form under pressure — baseline, training, post-assessment, and a recertification cycle that keeps the standard real."
      headerImage="/marketing/wireframe-mountains-2.jpg"
    >
      <SectionFrame code="SECT.01 / HOW IT WORKS">
        <div className="mb-3">
          <SectionLabel>How it works</SectionLabel>
        </div>
        <h2 className="mvs-display text-4xl sm:text-5xl font-bold uppercase tracking-wide text-zinc-100 mb-12">
          Four stages.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {STEPS.map((s, i) => (
            <HudCard
              key={s.title}
              label={`STAGE ${i + 1}`}
              code={`${String(i + 1).padStart(2, '0')} / 04`}
            >
              <h3 className="mvs-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-zinc-100 mb-3">
                {s.title}
              </h3>
              <p className="text-zinc-300 leading-relaxed">{s.body}</p>
            </HudCard>
          ))}
        </div>
      </SectionFrame>

      <SectionFrame code="SECT.02 / FOR ORGS">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <SectionLabel align="center">For organizations</SectionLabel>
          <h2 className="mvs-display text-4xl sm:text-5xl font-bold uppercase tracking-wide text-zinc-100">
            Get your team certified.
          </h2>
          <p className="text-zinc-300 leading-relaxed text-lg">
            Schedule a briefing to discuss certification windows, group sizing,
            and recertification cycles for your org.
          </p>
          <div className="flex justify-center">
            <HudButton href="/contact" size="lg">
              Request a briefing
            </HudButton>
          </div>
        </div>
      </SectionFrame>
    </PageShell>
  );
}
