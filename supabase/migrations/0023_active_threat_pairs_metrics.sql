-- 0023_active_threat_pairs_metrics.sql
-- Phase A: extend dashboard_active_threat_pairs with the doctrine
-- pre/post deltas (Net Governance Load, Instability Load, RT SD) from
-- phase1_session_metrics (migration 0022), alongside the existing
-- path-divergence + first-RT columns (unchanged). Phase 2 = same
-- scenario at post, so this is the pre->post comparison surface.

create or replace view dashboard_active_threat_pairs
with (security_invoker = true) as
with pre_enr as (
  select e.student_id, e.id
    from enrollments e
    join assessments a on a.id = e.assessment_id
   where a.code = 'active_threat_v1'
     and e.phase = 'pre'
     and e.completed_at is not null
),
post_enr as (
  select e.student_id, e.id
    from enrollments e
    join assessments a on a.id = e.assessment_id
   where a.code = 'active_threat_v1'
     and e.phase = 'post'
     and e.completed_at is not null
)
select
  pre.student_id,
  pre.id  as pre_enrollment_id,
  post.id as post_enrollment_id,
  pre_es.avg_rt_ms  as pre_avg_rt,
  post_es.avg_rt_ms as post_avg_rt,
  pre_w.branch_path  as pre_branch,
  post_w.branch_path as post_branch,
  (pre_w.branch_path is distinct from post_w.branch_path) as path_diverged,
  (select rt_ms from responses_long
     where enrollment_id = pre.id
     order by timestamp asc limit 1) as pre_first_rt,
  (select rt_ms from responses_long
     where enrollment_id = post.id
     order by timestamp asc limit 1) as post_first_rt,
  -- Doctrine metrics (migration 0022 phase1_session_metrics).
  psm_pre.net_governance_load  as pre_net_governance_load,
  psm_post.net_governance_load as post_net_governance_load,
  psm_pre.instability_load     as pre_instability_load,
  psm_post.instability_load    as post_instability_load,
  psm_pre.rt_sd                as pre_rt_sd,
  psm_post.rt_sd               as post_rt_sd
from pre_enr pre
join post_enr post on post.student_id = pre.student_id
join enrollment_scores pre_es  on pre_es.enrollment_id  = pre.id
join enrollment_scores post_es on post_es.enrollment_id = post.id
left join responses_wide pre_w  on pre_w.enrollment_id  = pre.id
left join responses_wide post_w on post_w.enrollment_id = post.id
left join phase1_session_metrics psm_pre  on psm_pre.enrollment_id  = pre.id
left join phase1_session_metrics psm_post on psm_post.enrollment_id = post.id;
