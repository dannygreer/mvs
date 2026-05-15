// Shared 3-phase session-day landing UI. Rendered by the real student
// route (/app) and by the admin preview route
// (/mvs/admin/preview/student-landing). Pure presentation — the caller
// computes phase state + hrefs and passes them in.
import Link from 'next/link';

export type PhaseState = 'active' | 'locked' | 'done' | 'missing';

export interface PhaseConfig {
  number: 1 | 2 | 3;
  title: string;
  description: string;
  state: PhaseState;
  href: string | null;
}

interface Props {
  eyebrow: string;
  heading: string;
  intro: string;
  phases: PhaseConfig[];
  // CTA label for the active card. Students see "Start →"; the admin
  // preview uses "Preview →".
  ctaLabel?: string;
  // Optional banner rendered above the cards (admin preview notice).
  banner?: React.ReactNode;
  // Open the active-card link in a new tab (admin preview deep-links
  // into the existing preview routes).
  ctaNewTab?: boolean;
}

export default function PhaseLanding({
  eyebrow,
  heading,
  intro,
  phases,
  ctaLabel = 'Start →',
  banner,
  ctaNewTab = false,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      {banner}
      <div>
        <p className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500">
          {eyebrow}
        </p>
        <h1 className="mvs-display text-3xl font-bold text-zinc-900 mt-1">
          {heading}
        </h1>
        <p className="text-sm text-zinc-600 mt-2">{intro}</p>
      </div>

      {phases.map((p) => (
        <PhaseCard
          key={p.number}
          config={p}
          ctaLabel={ctaLabel}
          ctaNewTab={ctaNewTab}
        />
      ))}
    </div>
  );
}

function PhaseCard({
  config,
  ctaLabel,
  ctaNewTab,
}: {
  config: PhaseConfig;
  ctaLabel: string;
  ctaNewTab: boolean;
}) {
  const { number, title, description, state, href } = config;

  const tone =
    state === 'active'
      ? 'border-cyan-700 bg-white shadow-sm'
      : state === 'done'
      ? 'border-emerald-200 bg-emerald-50/40'
      : 'border-zinc-200 bg-zinc-50 opacity-70';

  const cta =
    state === 'active' ? (
      <Link
        href={href ?? '#'}
        target={ctaNewTab ? '_blank' : undefined}
        rel={ctaNewTab ? 'noopener noreferrer' : undefined}
        className="mvs-mono px-5 py-3 bg-zinc-900 text-white rounded-lg text-sm uppercase tracking-widest hover:bg-zinc-800 transition-colors whitespace-nowrap"
      >
        {ctaLabel}
      </Link>
    ) : state === 'done' ? (
      <span className="mvs-mono px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs uppercase tracking-widest">
        Complete ✓
      </span>
    ) : state === 'locked' ? (
      <span className="mvs-mono px-3 py-1.5 bg-zinc-200 text-zinc-500 rounded-full text-xs uppercase tracking-widest">
        Locked
      </span>
    ) : (
      <span className="mvs-mono px-3 py-1.5 bg-zinc-200 text-zinc-500 rounded-full text-xs uppercase tracking-widest">
        Not assigned
      </span>
    );

  return (
    <section
      className={`border-2 rounded-2xl p-6 flex items-start justify-between gap-4 transition-colors ${tone}`}
    >
      <div className="flex-1 min-w-0">
        <p className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500">
          Phase {number}
        </p>
        <h2 className="mvs-display text-xl font-bold text-zinc-900 mt-1">
          {title}
        </h2>
        <p className="text-sm text-zinc-600 mt-2">{description}</p>
      </div>
      <div className="shrink-0">{cta}</div>
    </section>
  );
}
