// HUD-style mission panel for the hero right column. Plex Mono throughout,
// bracketed chrome, status indicator. Sits over the radar backdrop.

const ITEMS: { id: string; icon: React.ReactNode; label: string }[] = [
  {
    id: 'M.01',
    label: 'Recognize mental velocity',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 stroke-[#4FA9F0]" strokeWidth="1.4">
        <path d="M9 4a5 5 0 0 0-5 5v3l-1 2 1 1v3a3 3 0 0 0 3 3h2v-2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 4a5 5 0 0 1 9 3v8a3 3 0 0 1-3 3h-1v2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 11c.5-.7 1.5-1 2.5-.5M14.5 13c-.5.7-1.5 1-2.5.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'M.02',
    label: 'Control your response',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 stroke-[#4FA9F0]" strokeWidth="1.4">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <line x1="12" y1="2" x2="12" y2="5" strokeLinecap="round" />
        <line x1="12" y1="19" x2="12" y2="22" strokeLinecap="round" />
        <line x1="2" y1="12" x2="5" y2="12" strokeLinecap="round" />
        <line x1="19" y1="12" x2="22" y2="12" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'M.03',
    label: 'Optimize your decisions',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 stroke-[#4FA9F0]" strokeWidth="1.4">
        <line x1="5" y1="20" x2="5" y2="14" strokeLinecap="round" />
        <line x1="10" y1="20" x2="10" y2="10" strokeLinecap="round" />
        <line x1="15" y1="20" x2="15" y2="6" strokeLinecap="round" />
        <line x1="20" y1="20" x2="20" y2="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'M.04',
    label: 'Protect mission and people',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 stroke-[#4FA9F0]" strokeWidth="1.4">
        <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" strokeLinejoin="round" />
        <path d="M9.5 12 11 13.5 14.5 10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function MissionPanel() {
  return (
    <div className="relative mvs-mono">
      {/* Outer bracket chrome */}
      <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#4FA9F0]" />
      <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#4FA9F0]" />
      <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#4FA9F0]" />
      <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#4FA9F0]" />

      <div
        className="relative bg-zinc-950/65 backdrop-blur-md"
        style={{
          border: '1px solid rgba(1,111,212,0.45)',
          boxShadow:
            'inset 0 0 30px rgba(1,111,212,0.06), 0 0 60px rgba(1,111,212,0.10)',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{
            borderBottom: '1px solid rgba(1,111,212,0.35)',
            background:
              'linear-gradient(180deg, rgba(1,111,212,0.18) 0%, rgba(1,111,212,0.04) 100%)',
          }}
        >
          <div className="flex items-center gap-2">
            <h3 className="hud-glitch mvs-display text-base sm:text-lg font-bold text-[#4FA9F0] tracking-[0.28em] uppercase">
              YOUR MISSION
            </h3>
          </div>
          <span className="hud-blink flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-emerald-400">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </span>
            ACTIVE
          </span>
        </div>

        {/* Items */}
        <div className="px-5 sm:px-6">
          {ITEMS.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[auto_auto_1fr] items-center gap-4 sm:gap-5 py-4 sm:py-5"
              style={{ borderBottom: '1px dashed rgba(1,111,212,0.18)' }}
            >
              <span className="text-[10px] text-zinc-500 tracking-widest tabular-nums">
                {item.id}
              </span>
              <div className="shrink-0">{item.icon}</div>
              <p className="text-zinc-100 text-sm sm:text-base leading-snug">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Footer chrome */}
        <div
          className="flex items-center px-5 py-2 text-[10px] uppercase tracking-widest text-zinc-500"
          style={{
            borderTop: '1px solid rgba(1,111,212,0.25)',
            background: 'rgba(1,111,212,0.04)',
          }}
        >
          <span>04 / 04 OBJECTIVES</span>
        </div>
      </div>
    </div>
  );
}
