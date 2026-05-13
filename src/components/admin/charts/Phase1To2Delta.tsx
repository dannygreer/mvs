'use client';

// Path divergence + first-decision RT delta + 8-marker reduction chart
// triplet. Extracted from DashboardClient.tsx so the Dashboard's Section B
// and the Phase 2 admin page can both render the same charts without
// duplicating Recharts code.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import type { ActiveThreatPair, MarkerAggregate } from '@/lib/dashboard';

interface Props {
  pairs: ActiveThreatPair[];
  markers: MarkerAggregate[];
}

export default function Phase1To2Delta({ pairs, markers }: Props) {
  const divergedCount = pairs.filter((p) => p.path_diverged).length;
  const divergencePct =
    pairs.length === 0 ? 0 : Math.round((100 * divergedCount) / pairs.length);

  const firstRtPre =
    pairs.filter((p) => p.pre_first_rt != null).reduce(
      (a, p) => a + (p.pre_first_rt ?? 0),
      0,
    ) / (pairs.filter((p) => p.pre_first_rt != null).length || 1);
  const firstRtPost =
    pairs.filter((p) => p.post_first_rt != null).reduce(
      (a, p) => a + (p.post_first_rt ?? 0),
      0,
    ) / (pairs.filter((p) => p.post_first_rt != null).length || 1);
  const firstRtDelta = Math.round(firstRtPost - firstRtPre);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Pre → Post path divergence</CardTitle>
          {pairs.length === 0 ? (
            <EmptyState text="Awaiting students with both pre and post completions." />
          ) : (
            <>
              <div className="mvs-display text-5xl font-bold text-zinc-900 mt-2">
                {divergencePct}%
              </div>
              <p className="text-sm text-zinc-500 mt-1">
                {divergedCount} of {pairs.length} students took a different
                decision path post-training.
              </p>
              <p className="mvs-mono text-[10px] text-zinc-400 mt-3 uppercase tracking-widest">
                Same scenario, different decisions = changed decision profile.
              </p>
            </>
          )}
        </Card>

        <Card>
          <CardTitle>First-decision reaction time</CardTitle>
          {pairs.length === 0 ? (
            <EmptyState text="Awaiting pre / post pairs." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[
                    { phase: 'Pre', rt: Math.round(firstRtPre) },
                    { phase: 'Post', rt: Math.round(firstRtPost) },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis
                    dataKey="phase"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    unit=" ms"
                    width={70}
                  />
                  <Tooltip
                    formatter={(v) => `${v} ms`}
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  />
                  <Bar dataKey="rt" fill="#0891b2" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="mvs-mono text-[10px] text-zinc-400 mt-2 uppercase tracking-widest text-center">
                Δ {firstRtDelta >= 0 ? '+' : ''}
                {firstRtDelta} ms — higher post = more deliberation (good per doctrine)
              </p>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Event-marker reduction (pre vs post)</CardTitle>
        <MarkerReductionChart markers={markers} />
      </Card>
    </>
  );
}

function MarkerReductionChart({ markers }: { markers: MarkerAggregate[] }) {
  const byMarker = new Map<
    string,
    { marker: string; pre: number; post: number }
  >();
  for (const r of markers) {
    const slot = byMarker.get(r.marker) ?? { marker: r.marker, pre: 0, post: 0 };
    if (r.phase === 'pre') slot.pre = Number(r.fire_rate_pct);
    if (r.phase === 'post') slot.post = Number(r.fire_rate_pct);
    byMarker.set(r.marker, slot);
  }
  const data = Array.from(byMarker.values());
  const anyFires = data.some((d) => d.pre > 0 || d.post > 0);

  if (!anyFires) {
    return (
      <div className="mt-4 p-6 border border-dashed border-zinc-300 rounded-lg bg-zinc-50">
        <p className="text-sm text-zinc-600">
          No marker fires recorded yet — the chart will populate as Dr. Scully
          tags option-marker associations in the Phase 1 + Phase 3 editors.
        </p>
        <p className="mvs-mono text-[10px] text-zinc-400 uppercase tracking-widest mt-2">
          See needs_doctor.md §2b
        </p>
      </div>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="marker"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={70}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            unit="%"
            width={50}
          />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(2)}%`}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="pre" name="Pre" fill="#a1a1aa" radius={[2, 2, 0, 0]} />
          <Bar dataKey="post" name="Post" fill="#0891b2" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.post <= d.pre ? '#0891b2' : '#dc2626'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mvs-mono text-[10px] text-zinc-400 mt-2 uppercase tracking-widest">
        Lower post (cyan) = doctrine improvement. Higher post (red) = regression.
      </p>
    </>
  );
}

// Local presentational helpers — duplicated from DashboardClient for now;
// could be promoted to a shared file later if more pages need them.
function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-zinc-200 rounded-xl p-4 ${className}`}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500">
      {children}
    </p>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-2 p-6 border border-dashed border-zinc-300 rounded-lg bg-zinc-50 text-sm text-zinc-500">
      {text}
    </div>
  );
}
