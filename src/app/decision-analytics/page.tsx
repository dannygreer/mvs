import PageShell from '@/components/marketing/PageShell';
import SectionFrame from '@/components/marketing/SectionFrame';
import PerformanceSnapshot from '@/components/marketing/PerformanceSnapshot';
import SectionLabel from '@/components/marketing/SectionLabel';
import HudButton from '@/components/marketing/HudButton';
import HudCard from '@/components/marketing/HudCard';
import MetricInline from '@/components/marketing/MetricInline';

export const metadata = {
  title: 'Decision Analytics — MVS',
  description:
    'Behavioral analytics on every decision: reaction time, sequence integrity, premature commitment, decision accuracy.',
};

const METRICS: {
  label: string;
  body: string;
  value: number;
  status: 'GOOD' | 'LOW RISK';
}[] = [
  {
    label: 'Latency Control',
    body: 'How well your reaction time matches the demand of the moment. Too fast collapses information; too slow misses the window.',
    value: 95,
    status: 'GOOD',
  },
  {
    label: 'Sequence Integrity',
    body: 'Whether decisions are made in the right order. Cumulative sequence breaks are how good people produce bad outcomes.',
    value: 96,
    status: 'GOOD',
  },
  {
    label: 'Premature Commitment',
    body: 'How often your response begins forming before information completes. The earliest signal of perceptual narrowing.',
    value: 21,
    status: 'LOW RISK',
  },
  {
    label: 'Decision Accuracy',
    body: 'Hit rate on the questions where the doctrine has a defensible answer. Floor metric — necessary but not sufficient.',
    value: 98,
    status: 'GOOD',
  },
];

export default function DecisionAnalyticsPage() {
  return (
    <PageShell
      eyebrow="Decision Analytics"
      title="Every decision is data."
      intro="MVS captures not just what was decided, but how. Reaction time, sequence, branching, recovery — measured per decision, surfaced as actionable analytics."
      headerImage="/marketing/wireframe-mountains-1.png"
    >
      <SectionFrame code="SECT.01 / AT A GLANCE">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
          <div className="space-y-6">
            <SectionLabel>At a glance</SectionLabel>
            <h2 className="mvs-display text-4xl sm:text-5xl font-bold uppercase tracking-wide text-zinc-100">
              The MVS Index.
            </h2>
            <p className="text-zinc-300 leading-relaxed text-lg max-w-xl">
              A single number summarizes overall performance.
              <br />
              <br />
              Underneath it, four independent dimensions show where decisions
              broke down — and where they held.
            </p>
          </div>
          <div>
            <PerformanceSnapshot showMetrics={false} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mt-12 lg:mt-16">
          {METRICS.map((m, i) => (
            <HudCard
              key={m.label}
              code={`D.0${i + 1} / 04`}
            >
              <h3 className="mvs-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-zinc-100 mb-3">
                {m.label}
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-4">{m.body}</p>
              <MetricInline value={m.value} status={m.status} flavor={i} />
            </HudCard>
          ))}
        </div>
      </SectionFrame>

      <SectionFrame code="SECT.03 / FOR TEAMS">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <SectionLabel align="center">See it on your team</SectionLabel>
          <h2 className="mvs-display text-4xl sm:text-5xl font-bold uppercase tracking-wide text-zinc-100">
            Request a briefing.
          </h2>
          <p className="text-zinc-300 leading-relaxed text-lg">
            We&apos;ll walk through sample analytics from a comparable
            organization and discuss what your reporting would look like.
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
