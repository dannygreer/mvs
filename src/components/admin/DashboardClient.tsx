'use client';

// Super-admin dashboard. Renders 4 sections:
//   A — Volume & Activity
//   B — Training Effectiveness (the doctor's pitch deck charts)
//   C — Certification
//   D — Operational Health
//
// Pure presentation: all aggregates are computed by the SQL views in
// migration 0015 and arrive as props from the Server Component parent.
// Empty-state branches guard each chart so the dashboard renders cleanly
// even when the doctor hasn't tagged option-markers yet (which makes
// dashboard_marker_aggregates all-zero today).
import type {
  DashboardSnapshot,
  ActiveThreatPair,
  MarkerAggregate,
  ExamCertification,
} from '@/lib/dashboard';
import Phase1To2Delta from './charts/Phase1To2Delta';
import CertificationCharts from './charts/CertificationCharts';

interface Props {
  snapshot: DashboardSnapshot;
}

export default function DashboardClient({ snapshot }: Props) {
  const { volume, activeThreatPairs, markers, certification } = snapshot;

  return (
    <div className="space-y-10">
      <SectionVolume volume={volume} />
      <SectionEffectiveness
        pairs={activeThreatPairs}
        markers={markers}
      />
      <SectionCertification certification={certification} />
      <PrintDeckLink />
    </div>
  );
}

// ---------------------------------------------------------------------
// Section A — Volume & Activity
// ---------------------------------------------------------------------
function SectionVolume({
  volume,
}: {
  volume: DashboardSnapshot['volume'];
}) {
  return (
    <section>
      <SectionHeader label="Volume & Activity" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Orgs" value={volume?.total_orgs ?? 0} />
        <Tile label="Students" value={volume?.total_students ?? 0} />
        <Tile
          label="Completed enrollments"
          value={volume?.total_completed_sessions ?? 0}
        />
        <Tile
          label="In flight"
          value={volume?.in_flight_sessions ?? 0}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Section B — Training Effectiveness (the pitch deck)
// Now delegates to the shared <Phase1To2Delta /> component so the Phase 2
// admin page can render the same charts without duplication.
// ---------------------------------------------------------------------
function SectionEffectiveness({
  pairs,
  markers,
}: {
  pairs: ActiveThreatPair[];
  markers: MarkerAggregate[];
}) {
  return (
    <section data-pitch>
      <SectionHeader label="Training Effectiveness" />
      <Phase1To2Delta pairs={pairs} markers={markers} />
    </section>
  );
}

// ---------------------------------------------------------------------
// Section C — Certification (delegates to shared <CertificationCharts />)
// ---------------------------------------------------------------------
function SectionCertification({
  certification,
}: {
  certification: ExamCertification[];
}) {
  return (
    <section data-pitch>
      <SectionHeader label="Certification" />
      <CertificationCharts certification={certification} />
    </section>
  );
}

// ---------------------------------------------------------------------
// Pitch-deck print mode link
// ---------------------------------------------------------------------
function PrintDeckLink() {
  return (
    <p className="text-center pt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
      <a
        href="/mvs/admin/pitch"
        className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-700"
      >
        Print pitch deck view →
      </a>
      <a
        href="/mvs/admin/preview/student-landing"
        target="_blank"
        rel="noopener noreferrer"
        className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-700"
      >
        Preview student landing ↗
      </a>
    </p>
  );
}

// ---------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------
function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="mvs-mono text-xs font-semibold text-zinc-900 uppercase tracking-[0.22em] mb-3">
      {label}
    </h2>
  );
}

function Tile({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <p className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mvs-display text-3xl font-bold text-zinc-900 mt-1 tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-2 p-6 border border-dashed border-zinc-300 rounded-lg bg-zinc-50 text-sm text-zinc-500">
      {text}
    </div>
  );
}
