// HUD-style performance snapshot mock for the marketing page.
// Donut + 4 metric cards with sparklines. SVG, no real data.
// Lives next to the "What it is" copy as a visual preview of what users
// see inside the portal.

const METRICS = [
  { label: 'LATENCY CONTROL', value: 95, status: 'GOOD' as const },
  { label: 'SEQUENCE INTEGRITY', value: 96, status: 'GOOD' as const },
  { label: 'PREMATURE COMMITMENT', value: 21, status: 'LOW RISK' as const },
  { label: 'DECISION ACCURACY', value: 98, status: 'GOOD' as const },
];

const STATUS_COLOR: Record<string, string> = {
  GOOD: 'text-emerald-400',
  'LOW RISK': 'text-emerald-400',
};

// Pre-baked bar histogram per metric — segmented bars feel more "scope
// readout" than a smooth sparkline.
function BarChart({ flavor }: { flavor: number }) {
  const series = [
    [3, 5, 4, 7, 6, 8, 7, 9, 8, 10],
    [4, 6, 5, 8, 7, 6, 9, 8, 10, 9],
    [9, 8, 6, 7, 5, 4, 3, 4, 3, 2],
    [4, 5, 6, 5, 7, 8, 7, 9, 10, 9],
  ];
  const data = series[flavor % series.length];
  const max = Math.max(...data);
  return (
    <div
      className="flex items-end gap-[2px] h-7 mt-3"
      role="img"
      aria-hidden="true"
    >
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1"
          style={{
            height: `${(v / max) * 100}%`,
            background:
              'linear-gradient(180deg, rgba(52,211,153,0.85) 0%, rgba(52,211,153,0.35) 100%)',
            opacity: 0.4 + (i / data.length) * 0.6,
          }}
        />
      ))}
    </div>
  );
}

function Donut({ value }: { value: number }) {
  const radius = 60;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  // 24 tick marks around the perimeter — every 15°. The 4 cardinal ticks
  // (N/E/S/W) are slightly longer and brighter to read like a compass dial.
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);

  return (
    <div className="relative w-[180px] h-[180px]">
      <svg viewBox="0 0 160 160" className="w-full h-full">
        <defs>
          <linearGradient id="donut-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4FA9F0" />
            <stop offset="100%" stopColor="#016FD4" />
          </linearGradient>
        </defs>

        {/* perimeter tick marks */}
        <g>
          {ticks.map((deg) => {
            const isCardinal = deg % 90 === 0;
            const inner = isCardinal ? 70 : 73;
            const outer = 78;
            const rad = ((deg - 90) * Math.PI) / 180;
            const x1 = 80 + inner * Math.cos(rad);
            const y1 = 80 + inner * Math.sin(rad);
            const x2 = 80 + outer * Math.cos(rad);
            const y2 = 80 + outer * Math.sin(rad);
            return (
              <line
                key={deg}
                x1={x1.toFixed(2)}
                y1={y1.toFixed(2)}
                x2={x2.toFixed(2)}
                y2={y2.toFixed(2)}
                stroke={isCardinal ? '#4FA9F0' : '#1e293b'}
                strokeOpacity={isCardinal ? 0.7 : 1}
                strokeWidth={isCardinal ? 1.4 : 1}
              />
            );
          })}
        </g>

        {/* track + value (rotated -90deg so 0 starts at top) */}
        <g transform="rotate(-90 80 80)">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={stroke}
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="url(#donut-grad)"
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{ filter: 'drop-shadow(0 0 6px rgba(1,111,212,0.7))' }}
          />
        </g>

        {/* faint inner crosshair */}
        <line x1="80" y1="35" x2="80" y2="42" stroke="#4FA9F0" strokeOpacity="0.3" strokeWidth="0.8" />
        <line x1="80" y1="118" x2="80" y2="125" stroke="#4FA9F0" strokeOpacity="0.3" strokeWidth="0.8" />
        <line x1="35" y1="80" x2="42" y2="80" stroke="#4FA9F0" strokeOpacity="0.3" strokeWidth="0.8" />
        <line x1="118" y1="80" x2="125" y2="80" stroke="#4FA9F0" strokeOpacity="0.3" strokeWidth="0.8" />
      </svg>

    </div>
  );
}

export default function PerformanceSnapshot({
  showDonut = true,
  showMetrics = true,
}: {
  showDonut?: boolean;
  showMetrics?: boolean;
} = {}) {
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
            <span className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
              [DATA]
            </span>
            <h3 className="mvs-display text-base sm:text-lg font-bold text-[#4FA9F0] tracking-[0.28em] uppercase">
              PERFORMANCE SNAPSHOT
            </h3>
          </div>
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">
            LIVE
          </span>
        </div>

        {/* Instrument cluster — donut + index readout, stretched to the
            same full panel width as the header bar. Hidden on the homepage
            where the metric grid alone is the focal element. */}
        {showDonut && (
          <div
            className="flex items-center gap-6 sm:gap-8 px-5 py-5 w-full"
            style={{ borderBottom: '1px solid rgba(1,111,212,0.20)' }}
          >
            <Donut value={92} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mvs-mono">
                <span className="w-2 h-px bg-[#4FA9F0]" />
                <span className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
                  MVS INDEX
                </span>
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="mvs-display text-[5.5rem] sm:text-[6.5rem] font-bold text-zinc-100 tabular-nums leading-none">
                  92
                </span>
                <span className="mvs-mono text-sm tracking-[0.2em] text-zinc-500 uppercase">
                  / 100
                </span>
              </div>
            </div>
          </div>
        )}

        {showMetrics && (
        <div className="px-5 py-5">
          <div className="grid grid-cols-2 gap-3 w-full">
            {METRICS.map((m, i) => (
              <div key={m.label} className="relative">
                {/* corner brackets */}
                <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#4FA9F0]" />
                <span className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#4FA9F0]" />
                <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#4FA9F0]" />
                <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#4FA9F0]" />

                <div
                  className="relative bg-zinc-900/70 p-3"
                  style={{ border: '1px solid rgba(1,111,212,0.25)' }}
                >
                  {/* top stripe + mono id */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-px bg-[#4FA9F0]" />
                      <span className="text-[8px] tabular-nums tracking-widest text-zinc-500">
                        M.0{i + 1}
                      </span>
                    </div>
                    <span className="text-[8px] tracking-widest text-zinc-600 uppercase">
                      LIVE
                    </span>
                  </div>

                  <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-400 leading-tight">
                    {m.label}
                  </p>
                  <p className="text-3xl font-bold text-zinc-100 tabular-nums mt-1">
                    {m.value}%
                  </p>

                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        STATUS_COLOR[m.status]?.includes('emerald')
                          ? 'bg-emerald-400'
                          : 'bg-zinc-500'
                      }`}
                    />
                    <p
                      className={`text-[10px] uppercase tracking-wider font-semibold ${
                        STATUS_COLOR[m.status]
                      }`}
                    >
                      {m.status}
                    </p>
                  </div>

                  <BarChart flavor={i} />
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Footer chrome */}
        <div
          className="flex items-center justify-between px-5 py-2 text-[10px] uppercase tracking-widest text-zinc-500"
          style={{
            borderTop: '1px solid rgba(1,111,212,0.25)',
            background: 'rgba(1,111,212,0.04)',
          }}
        >
          <span>SCAN.04 / TIMING.OK</span>
          <span>SYS.OK</span>
        </div>
      </div>
    </div>
  );
}
