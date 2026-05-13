// Server-side loaders for the six dashboard SQL views (migration 0015).
// Uses the same service-role client pattern as src/lib/db.ts because the
// dashboard is super_admin-only and the page itself enforces that via
// requireSuperAdmin(). Views ALSO have security_invoker = true so a stray
// caller without the role would get zero rows back regardless.

import { createClient } from '@supabase/supabase-js';

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface DashboardVolume {
  total_orgs: number;
  total_students: number;
  total_completed_sessions: number;
  in_flight_sessions: number;
}

export interface CompletionRow {
  assessment_code: string;
  assessment_name: string;
  assessment_kind: 'scenario' | 'multi_choice';
  phase: 'pre' | 'post' | 'practice';
  enrolled: number;
  completed: number;
  completion_pct: number;
}

// PII note: the view exposes student_id + enrollment_id; the dashboard
// only needs the aggregate fields to render charts, so we keep IDs off
// the wire entirely. Anyone needing individual drill-downs uses the
// per-org admin views (/mvs/admin/orgs/[id]) which already have RLS.
export interface ActiveThreatPair {
  pre_avg_rt: number | null;
  post_avg_rt: number | null;
  pre_branch: string | null;
  post_branch: string | null;
  path_diverged: boolean;
  pre_first_rt: number | null;
  post_first_rt: number | null;
}

export interface MarkerAggregate {
  marker: string;
  phase: 'pre' | 'post' | 'practice';
  fired_count: number;
  total_events: number;
  fire_rate_pct: number;
}

export interface ExamCertification {
  enrollment_id: string;
  score_percent: number | null;
  pass: boolean | null;
  tier: 'incomplete' | 'high' | 'certified' | 'borderline' | 'not_certified';
}

export interface OperationalRow {
  avg_invite_to_completion_hours: number | null;
  abandoned_count: number;
  total_invited_incomplete: number;
}

export interface DashboardSnapshot {
  volume: DashboardVolume | null;
  completion: CompletionRow[];
  activeThreatPairs: ActiveThreatPair[];
  markers: MarkerAggregate[];
  certification: ExamCertification[];
  operational: OperationalRow | null;
}

// Phase 2 only renders the active-threat pre/post pairs, the marker
// chart, and the post-completion count. Skip the 3 unused dashboard
// views entirely.
export interface Phase2Snapshot {
  activeThreatPairs: ActiveThreatPair[];
  markers: MarkerAggregate[];
  postCompletion: CompletionRow | null;
}
export async function loadPhase2Snapshot(): Promise<Phase2Snapshot> {
  const sb = client();
  const [pairs, markers, completion] = await Promise.all([
    sb
      .from('dashboard_active_threat_pairs')
      .select(
        'pre_avg_rt, post_avg_rt, pre_branch, post_branch, path_diverged, pre_first_rt, post_first_rt',
      ),
    sb.from('dashboard_marker_aggregates').select('*'),
    sb
      .from('dashboard_completion_by_assessment')
      .select('*')
      .eq('assessment_code', 'active_threat_v1')
      .eq('phase', 'post')
      .maybeSingle(),
  ]);
  return {
    activeThreatPairs: (pairs.data as ActiveThreatPair[] | null) ?? [],
    markers: (markers.data as MarkerAggregate[] | null) ?? [],
    postCompletion: (completion.data as CompletionRow | null) ?? null,
  };
}

// Phase 3 only renders the certification tier breakdown. Skip the
// other 5 views.
export interface Phase3Snapshot {
  certification: ExamCertification[];
}
export async function loadPhase3Snapshot(): Promise<Phase3Snapshot> {
  const sb = client();
  const { data } = await sb.from('dashboard_exam_certification').select('*');
  return {
    certification: (data as ExamCertification[] | null) ?? [],
  };
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const sb = client();
  const [volume, completion, atPairs, markers, certification, operational] =
    await Promise.all([
      sb.from('dashboard_volume').select('*').single(),
      sb.from('dashboard_completion_by_assessment').select('*'),
      sb
        .from('dashboard_active_threat_pairs')
        .select(
          'pre_avg_rt, post_avg_rt, pre_branch, post_branch, path_diverged, pre_first_rt, post_first_rt',
        ),
      sb.from('dashboard_marker_aggregates').select('*'),
      sb.from('dashboard_exam_certification').select('*'),
      sb.from('dashboard_operational').select('*').single(),
    ]);

  return {
    volume: (volume.data as DashboardVolume | null) ?? null,
    completion: (completion.data as CompletionRow[] | null) ?? [],
    activeThreatPairs:
      (atPairs.data as ActiveThreatPair[] | null) ?? [],
    markers: (markers.data as MarkerAggregate[] | null) ?? [],
    certification: (certification.data as ExamCertification[] | null) ?? [],
    operational: (operational.data as OperationalRow | null) ?? null,
  };
}
