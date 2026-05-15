// Single source of truth for the student session-day landing. Rendered
// identically by the real student route (/app) and the admin preview
// (/mvs/admin/preview/student-landing) — the preview adds only its own
// admin overlays (view toggle + floating notice), nothing visual here
// diverges. Design tweaks made via the preview land on real /app
// automatically because both render this component.
//
// Dark marketing theme to match the public site: zinc-950 base with the
// radial gradient backdrop, brand-blue HUD cards, centered wordmark.
import Link from 'next/link';
import Image from 'next/image';

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
  ctaNewTab = false,
}: Props) {
  return (
    <>
      {/* Marketing-site backdrop: zinc-950 base + radial gradient,
          mirroring src/components/marketing/PageShell.tsx. */}
      <div className="fixed inset-0 -z-10 bg-zinc-950" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_30%,#0e1422_0%,#050810_60%,#000_100%)]" />

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="flex justify-start pb-6">
          <Image
            src="/mvs-logo.png"
            alt="MVS — Mental Velocity System"
            width={329}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </div>

        <div>
          <p className="mvs-mono text-[11px] uppercase tracking-widest text-[#4FA9F0]">
            {eyebrow}
          </p>
          <h1 className="mvs-display text-3xl font-bold uppercase tracking-wide text-zinc-100 mt-1">
            {heading}
          </h1>
          <p className="text-sm text-zinc-400 mt-2">{intro}</p>
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
    </>
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

  // HUD-card treatment mirroring src/components/marketing/HudCard.tsx —
  // sharp corners, thin brand-blue border, corner-bracket accents, mono
  // header strip. Accent color encodes phase state so the gating stays
  // legible against the dark backdrop.
  const accent =
    state === 'active'
      ? '#016FD4'
      : state === 'done'
      ? '#10B981'
      : '#52525B';
  const bracket =
    state === 'active'
      ? '#4FA9F0'
      : state === 'done'
      ? '#34D399'
      : '#52525B';
  const dim = state === 'locked' || state === 'missing';

  const cta =
    state === 'active' ? (
      <Link
        href={href ?? '#'}
        target={ctaNewTab ? '_blank' : undefined}
        rel={ctaNewTab ? 'noopener noreferrer' : undefined}
        className="mvs-mono px-5 py-3 bg-[#016FD4] text-white text-sm uppercase tracking-widest hover:bg-[#0a5fb0] transition-colors whitespace-nowrap"
      >
        {ctaLabel}
      </Link>
    ) : state === 'done' ? (
      <span className="mvs-mono px-3 py-1.5 text-[#34D399] text-xs uppercase tracking-widest">
        Complete ✓
      </span>
    ) : state === 'locked' ? (
      <span className="mvs-mono px-3 py-1.5 text-zinc-500 text-xs uppercase tracking-widest">
        Locked
      </span>
    ) : (
      <span className="mvs-mono px-3 py-1.5 text-zinc-500 text-xs uppercase tracking-widest">
        Not assigned
      </span>
    );

  return (
    <section className={`relative ${dim ? 'opacity-55' : ''}`}>
      {/* corner brackets */}
      <span
        className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2"
        style={{ borderColor: bracket }}
      />
      <span
        className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2"
        style={{ borderColor: bracket }}
      />
      <span
        className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2"
        style={{ borderColor: bracket }}
      />
      <span
        className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2"
        style={{ borderColor: bracket }}
      />

      <div
        className="relative bg-zinc-950/55 backdrop-blur-sm"
        style={{ border: `1px solid ${accent}55` }}
      >
        <div
          className="flex items-center justify-between px-4 py-2 mvs-mono"
          style={{
            borderBottom: `1px dashed ${accent}40`,
            background: `linear-gradient(180deg, ${accent}1f 0%, ${accent}05 100%)`,
          }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.25em]"
            style={{ color: state === 'active' ? '#4FA9F0' : accent }}
          >
            Phase {number}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 tabular-nums">
            {String(number).padStart(2, '0')} / 03
          </span>
        </div>
        <div className="p-6 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="mvs-display text-xl font-bold uppercase tracking-wide text-zinc-100">
              {title}
            </h2>
            <p className="text-sm text-zinc-400 mt-2">{description}</p>
          </div>
          <div className="shrink-0">{cta}</div>
        </div>
      </div>
    </section>
  );
}
