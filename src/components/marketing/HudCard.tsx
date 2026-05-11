// HUD-style card primitive. Sharp corners, thin brand-blue border,
// optional mono code label in top-left, bracket corner accents.
// Use anywhere we'd otherwise have a rounded SaaS card.
export default function HudCard({
  code,
  label,
  children,
  className = '',
  inner = 'p-5 sm:p-6',
}: {
  code?: string;            // e.g. "01" or "D.02" — small mono tag top-left
  label?: string;           // e.g. "DIMENSION" — small mono header
  children: React.ReactNode;
  className?: string;
  inner?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* corner brackets (slightly inset so they hug the panel border) */}
      <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#4FA9F0]" />
      <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#4FA9F0]" />
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#4FA9F0]" />
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#4FA9F0]" />

      <div
        className="relative bg-zinc-950/55 backdrop-blur-sm h-full flex flex-col"
        style={{
          border: '1px solid rgba(1,111,212,0.30)',
        }}
      >
        {(code || label) && (
          <div
            className="flex items-center justify-between px-4 py-2 mvs-mono"
            style={{
              borderBottom: '1px dashed rgba(1,111,212,0.25)',
              background:
                'linear-gradient(180deg, rgba(1,111,212,0.10) 0%, rgba(1,111,212,0.02) 100%)',
            }}
          >
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#4FA9F0]">
              {label}
            </span>
            {code && (
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 tabular-nums">
                {code}
              </span>
            )}
          </div>
        )}
        <div className={`${inner} flex-1`}>{children}</div>
      </div>
    </div>
  );
}
