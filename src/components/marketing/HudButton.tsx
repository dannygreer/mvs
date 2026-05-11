import Link from 'next/link';

// Military-HUD styled CTA. Renders as <a>/<Link>. Has corner brackets
// (animated outward on hover), uppercase mono-style label, brand-blue
// border + glow on hover, and a small ">" arrow that slides on hover.
//
// Use for the primary "Request a briefing" CTA across marketing pages.
export default function HudButton({
  href,
  children,
  size = 'md',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const isExternal = /^https?:/.test(href) || href.startsWith('mailto:');
  const padding = size === 'lg' ? 'px-10 py-4' : 'px-7 py-3';
  const text = size === 'lg' ? 'text-base' : 'text-sm';

  const inner = (
    <span
      className={`group relative inline-flex items-center gap-3 ${padding} ${text} mvs-mono uppercase tracking-[0.18em] text-[#4FA9F0] hover:text-white transition-colors duration-200 select-none`}
      style={{
        background:
          'linear-gradient(180deg, rgba(1,111,212,0.06) 0%, rgba(1,111,212,0.18) 100%)',
        border: '1px solid rgba(1,111,212,0.55)',
        boxShadow:
          '0 0 0 1px rgba(1,111,212,0.0), 0 0 24px rgba(1,111,212,0.0)',
      }}
      onMouseEnter={undefined}
    >
      {/* corner brackets — animate outward on hover */}
      <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#4FA9F0] -translate-x-px -translate-y-px transition-all duration-200 group-hover:-translate-x-1.5 group-hover:-translate-y-1.5 group-hover:w-4 group-hover:h-4" />
      <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#4FA9F0] translate-x-px -translate-y-px transition-all duration-200 group-hover:translate-x-1.5 group-hover:-translate-y-1.5 group-hover:w-4 group-hover:h-4" />
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#4FA9F0] translate-x-px translate-y-px transition-all duration-200 group-hover:translate-x-1.5 group-hover:translate-y-1.5 group-hover:w-4 group-hover:h-4" />
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#4FA9F0] -translate-x-px translate-y-px transition-all duration-200 group-hover:-translate-x-1.5 group-hover:translate-y-1.5 group-hover:w-4 group-hover:h-4" />

      {/* glow halo on hover */}
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(1,111,212,0.35) 0%, rgba(1,111,212,0) 70%)',
        }}
      />

      {/* label + arrow */}
      <span className="relative">{children}</span>
      <span
        className="relative text-[#4FA9F0] group-hover:text-white group-hover:translate-x-1 transition-all duration-200"
        aria-hidden="true"
      >
        {'›'}
      </span>
    </span>
  );

  if (isExternal) {
    return (
      <a href={href} className={`inline-block ${className}`}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={`inline-block ${className}`}>
      {inner}
    </Link>
  );
}
