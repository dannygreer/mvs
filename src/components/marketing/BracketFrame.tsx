// HUD-style frame with corner brackets and a faint full border. Replaces
// our default rounded card border with something that reads more "tactical
// console" than "marketing card" — without giving up legibility or padding.
//
// Usage: <BracketFrame>...</BracketFrame> wraps any block. Brackets sit
// outside the content padding so the inner content has full width.
export default function BracketFrame({
  children,
  className = '',
  inner = 'p-6 sm:p-8',
  tone = 'primary',
}: {
  children: React.ReactNode;
  className?: string;
  inner?: string;
  tone?: 'primary' | 'muted';
}) {
  const stroke = tone === 'primary' ? '#016FD4' : '#3f3f46';
  const accent = tone === 'primary' ? '#4FA9F0' : '#71717a';

  // Corner bracket SVG — 24px arms, 1.5px stroke, sits at each corner via
  // absolute positioning so they don't take layout space.
  const Corner = ({ rotate }: { rotate: number }) => (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${rotate}deg)` }}
      className="absolute"
    >
      <path
        d="M 0 12 L 0 0 L 12 0"
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
      />
    </svg>
  );

  return (
    <div className={`relative ${className}`}>
      {/* faint inner border */}
      <div
        className={`relative ${inner} bg-zinc-950/50 backdrop-blur-sm`}
        style={{ border: `1px solid ${stroke}33` }}
      >
        {children}
      </div>
      {/* corner brackets */}
      <span className="absolute top-0 left-0">
        <Corner rotate={0} />
      </span>
      <span className="absolute top-0 right-0">
        <Corner rotate={90} />
      </span>
      <span className="absolute bottom-0 right-0">
        <Corner rotate={180} />
      </span>
      <span className="absolute bottom-0 left-0">
        <Corner rotate={270} />
      </span>
    </div>
  );
}
