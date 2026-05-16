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

  // Doctrine deltas (Report Generation Logic §4/§7). Average the
  // paired metric across students who have a value on BOTH sides.
  const avgDelta = (
    pre: (p: ActiveThreatPair) => number | null,
    post: (p: ActiveThreatPair) => number | null,
  ) => {
    const both = pairs.filter(
      (p) => pre(p) != null && post(p) != null,
    );
    if (both.length === 0) return null;
    const a = (sel: (p: ActiveThreatPair) => number | null) =>
      both.reduce((s, p) => s + (sel(p) ?? 0), 0) / both.length;
    const preAvg = a(pre);
    const postAvg = a(post);
    return { preAvg, postAvg, delta: postAvg - preAvg, n: both.length };
  };
  const ngl = avgDelta(
    (p) => p.pre_net_governance_load,
    (p) => p.post_net_governance_load,
  );
  const instab = avgDelta(
    (p) => p.pre_instability_load,
    (p) => p.post_instability_load,
  );
  const rtsd = avgDelta(
    (p) => p.pre_rt_sd,
    (p) => p.post_rt_sd,
  );

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
                  <Bar dataKey="rt" radius={[2, 2, 0, 0]}>
                    <Cell fill="#a1a1aa" />
                    <Cell fill="#0891b2" />
                  </Bar>
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
        <CardTitle>Doctrine deltas (pre → post)</CardTitle>
        {ngl == null && instab == null && rtsd == null ? (
          <EmptyState text="No weighted-marker data yet. Populates once scenario options carry doctrine weights (5 screens seeded so far)." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
            <DoctrineDelta
              label="Net Governance Load"
              m={ngl}
              hint="Lower post = improved governance"
            />
            <DoctrineDelta
              label="Instability Load"
              m={instab}
              hint="Lower post = fewer instability markers"
            />
            <DoctrineDelta
              label="RT SD (s)"
              m={rtsd}
              hint="Lower post = steadier timing"
              decimals={2}
            />
          </div>
        )}
      </Card>

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
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            content={() => (
              <div className="text-center" style={{ fontSize: 11 }}>
                <LegendDot color="#a1a1aa" label="Pre" />
                <LegendDot color="#0891b2" label="Post" />
              </div>
            )}
          />
          <Bar dataKey="pre" name="Pre" fill="#a1a1aa" radius={[2, 2, 0, 0]} />
          <Bar dataKey="post" name="Post" fill="#0891b2" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginRight: 12,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          background: color,
          marginRight: 4,
        }}
      />
      {label}
    </span>
  );
}

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

function DoctrineDelta({
  label,
  m,
  hint,
  decimals = 1,
}: {
  label: string;
  m: { preAvg: number; postAvg: number; delta: number; n: number } | null;
  hint: string;
  decimals?: number;
}) {
  if (m == null) {
    return (
      <div className="border border-zinc-200 rounded-lg p-3">
        <p className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {label}
        </p>
        <p className="text-sm text-zinc-400 mt-2">No paired data</p>
      </div>
    );
  }
  // Lower post is the improvement direction for all three doctrine
  // metrics (governance/instability load down, timing SD down).
  const improved = m.delta < 0;
  const fmt = (n: number) => n.toFixed(decimals);
  return (
    <div className="border border-zinc-200 rounded-lg p-3">
      <p className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mvs-display text-2xl font-bold text-zinc-900 mt-1">
        {fmt(m.preAvg)} → {fmt(m.postAvg)}
      </p>
      <p
        className={`mvs-mono text-[11px] mt-1 ${
          improved ? 'text-emerald-600' : 'text-red-600'
        }`}
      >
        Δ {m.delta >= 0 ? '+' : ''}
        {fmt(m.delta)} {improved ? '↓ improved' : '↑ worse'}
      </p>
      <p className="text-[10px] text-zinc-400 mt-1">
        {hint} · n={m.n}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-2 p-6 border border-dashed border-zinc-300 rounded-lg bg-zinc-50 text-sm text-zinc-500">
      {text}
    </div>
  );
}
