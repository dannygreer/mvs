// Stripped-down metric readout: big % number, status dot+label, mini bar
// histogram. Reused inside PerformanceSnapshot's grid AND embedded in
// /decision-analytics dimension cards (without the top stripe/label that
// the snapshot version uses, since the surrounding card already has its
// own heading).

const STATUS_COLOR: Record<string, string> = {
  GOOD: 'text-emerald-400',
  'LOW RISK': 'text-emerald-400',
};

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

interface MetricInlineProps {
  value: number;
  status: 'GOOD' | 'LOW RISK';
  flavor: number;
}

export default function MetricInline({ value, status, flavor }: MetricInlineProps) {
  return (
    <div
      className="bg-zinc-900/70 p-3"
      style={{ border: '1px solid rgba(1,111,212,0.25)' }}
    >
      <p className="text-3xl font-bold text-zinc-100 tabular-nums">
        {value}%
      </p>
      <div className="flex items-center gap-1.5 mt-1">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            STATUS_COLOR[status]?.includes('emerald')
              ? 'bg-emerald-400'
              : 'bg-zinc-500'
          }`}
        />
        <p
          className={`text-[10px] uppercase tracking-wider font-semibold ${STATUS_COLOR[status]}`}
        >
          {status}
        </p>
      </div>
      <BarChart flavor={flavor} />
    </div>
  );
}
