-- 0022_phase1_session_metrics.sql
-- Phase A: per-session scoring metrics from the Report Generation Logic
-- spec §4 (Exact Individual-Level Calculations). One row per completed
-- scenario enrollment (Phase 1 pre + Phase 2 post both use the
-- active-threat scenario, so both are covered).
--
-- Marker totals SUM the integer weights snapshotted into
-- responses_long.event_markers at selection time (version-stable per
-- spec §10). recovery_total is normally negative (stabilizing).
-- Timing is in SECONDS to match the spec's thresholds.

create or replace view phase1_session_metrics
with (security_invoker = true) as
with ev as (
  select
    rl.enrollment_id,
    rl.question_id,
    rl.rt_ms,
    rl.timestamp,
    marker_weight(rl.event_markers, 'escalation')            as w_escalation,
    marker_weight(rl.event_markers, 'premature_commitment')  as w_premature,
    marker_weight(rl.event_markers, 'drift')                 as w_drift,
    marker_weight(rl.event_markers, 'sequencing_break')      as w_sequencing,
    marker_weight(rl.event_markers, 'governance_instability') as w_governance,
    marker_weight(rl.event_markers, 'narrowing')             as w_narrowing,
    marker_weight(rl.event_markers, 'recovery')              as w_recovery,
    marker_weight(rl.event_markers, 'intervention')          as w_intervention
  from responses_long rl
),
agg as (
  select
    e.id as enrollment_id,
    e.student_id,
    p.org_id,
    e.assessment_id,
    a.code as assessment_code,
    e.phase,
    e.completed_at,
    count(ev.*) as event_count,
    sum(ev.w_escalation)   as escalation_total,
    sum(ev.w_premature)    as premature_commitment_total,
    sum(ev.w_drift)        as drift_total,
    sum(ev.w_sequencing)   as sequencing_break_total,
    sum(ev.w_governance)   as governance_instability_total,
    sum(ev.w_narrowing)    as narrowing_total,
    sum(ev.w_recovery)     as recovery_total,
    sum(ev.w_intervention) as intervention_total,
    -- Timing in seconds (spec §4.2).
    round((avg(ev.rt_ms) / 1000.0)::numeric, 2)               as mean_rt,
    round((percentile_cont(0.5) within group (
      order by ev.rt_ms) / 1000.0)::numeric, 2)               as median_rt,
    round((max(ev.rt_ms) / 1000.0)::numeric, 2)               as max_rt,
    round((min(ev.rt_ms) / 1000.0)::numeric, 2)               as min_rt,
    round((coalesce(stddev_samp(ev.rt_ms), 0) / 1000.0)::numeric, 2) as rt_sd,
    round(((max(ev.rt_ms) - min(ev.rt_ms)) / 1000.0)::numeric, 2)    as rt_range,
    round((max(ev.rt_ms) filter (
      where ev.question_id = 'S5_CONVERGENCE') / 1000.0)::numeric, 2)   as s5_rt,
    round((max(ev.rt_ms) filter (
      where ev.question_id = 'S6_FINAL_PRESSURE') / 1000.0)::numeric, 2) as s6_rt
  from enrollments e
  join profiles p on p.id = e.student_id
  join assessments a on a.id = e.assessment_id and a.kind = 'scenario'
  left join ev on ev.enrollment_id = e.id
  group by e.id, e.student_id, p.org_id, e.assessment_id, a.code,
           e.phase, e.completed_at
)
select
  agg.*,
  -- Instability Load = sum of the 6 instability markers (spec §4.1;
  -- intervention is NOT part of the doctrine load formula).
  (escalation_total + premature_commitment_total + drift_total
   + sequencing_break_total + governance_instability_total
   + narrowing_total) as instability_load,
  -- Net Governance Load = instability_load + recovery_total
  -- (recovery negative pulls it down).
  (escalation_total + premature_commitment_total + drift_total
   + sequencing_break_total + governance_instability_total
   + narrowing_total + recovery_total) as net_governance_load,
  -- Compression Index = S5 RT - S6 RT (spec §4.2). NULL if either
  -- terminal node wasn't reached on this path.
  (s5_rt - s6_rt) as compression_index,
  -- Derived ratios (spec §4.3). Guard divide-by-zero.
  round((escalation_total + premature_commitment_total)::numeric
        / greatest(1, (escalation_total + premature_commitment_total
          + drift_total + sequencing_break_total
          + governance_instability_total + narrowing_total)), 3)
        as acceleration_ratio,
  round(drift_total::numeric
        / greatest(1, (escalation_total + premature_commitment_total
          + drift_total + sequencing_break_total
          + governance_instability_total + narrowing_total)), 3)
        as drift_ratio,
  round(sequencing_break_total::numeric
        / greatest(1, (escalation_total + premature_commitment_total
          + drift_total + sequencing_break_total
          + governance_instability_total + narrowing_total)), 3)
        as sequencing_ratio,
  round(abs(recovery_total)::numeric
        / greatest(1, (escalation_total + premature_commitment_total
          + drift_total + sequencing_break_total
          + governance_instability_total + narrowing_total)), 3)
        as recovery_offset
from agg;
