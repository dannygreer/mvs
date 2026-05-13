-- 0019_org_dashboard_functions.sql
-- Org-scoped equivalents of dashboard_active_threat_pairs and
-- dashboard_marker_aggregates. Postgres views can't take parameters,
-- so the per-org cuts live as security-invoker functions returning
-- the same row shapes the dashboard loaders already consume.

create or replace function public.org_active_threat_pairs(p_org_id uuid)
returns table (
  student_id uuid,
  pre_avg_rt numeric,
  post_avg_rt numeric,
  pre_branch text,
  post_branch text,
  path_diverged boolean,
  pre_first_rt int,
  post_first_rt int
)
language sql
security invoker
stable
as $$
  with pre_enr as (
    select e.student_id, e.id
      from enrollments e
      join assessments a on a.id = e.assessment_id
      join profiles p on p.id = e.student_id
     where a.code = 'active_threat_v1'
       and e.phase = 'pre'
       and e.completed_at is not null
       and p.org_id = p_org_id
  ),
  post_enr as (
    select e.student_id, e.id
      from enrollments e
      join assessments a on a.id = e.assessment_id
      join profiles p on p.id = e.student_id
     where a.code = 'active_threat_v1'
       and e.phase = 'post'
       and e.completed_at is not null
       and p.org_id = p_org_id
  )
  select
    pre.student_id,
    pre_es.avg_rt_ms as pre_avg_rt,
    post_es.avg_rt_ms as post_avg_rt,
    pre_w.branch_path as pre_branch,
    post_w.branch_path as post_branch,
    (pre_w.branch_path is distinct from post_w.branch_path) as path_diverged,
    (select rl.rt_ms from responses_long rl
       where rl.enrollment_id = pre.id
       order by rl.timestamp limit 1) as pre_first_rt,
    (select rl.rt_ms from responses_long rl
       where rl.enrollment_id = post.id
       order by rl.timestamp limit 1) as post_first_rt
  from pre_enr pre
  join post_enr post on post.student_id = pre.student_id
  join enrollment_scores pre_es on pre_es.enrollment_id = pre.id
  join enrollment_scores post_es on post_es.enrollment_id = post.id
  left join responses_wide pre_w on pre_w.enrollment_id = pre.id
  left join responses_wide post_w on post_w.enrollment_id = post.id;
$$;

create or replace function public.org_marker_aggregates(p_org_id uuid)
returns table (
  marker text,
  phase text,
  fired_count bigint,
  total_events bigint,
  fire_rate_pct numeric
)
language sql
security invoker
stable
as $$
  with marker_keys as (
    select unnest(array[
      'escalation','narrowing','premature_commitment','sequencing_break',
      'drift','intervention','recovery','governance_instability'
    ]) as marker
  ),
  event_pool as (
    select rl.event_markers, e.phase
      from responses_long rl
      join enrollments e on e.id = rl.enrollment_id
      join profiles p on p.id = e.student_id
     where rl.event_markers is not null
       and e.phase = any(array['pre','post'])
       and p.org_id = p_org_id
  )
  select
    m.marker,
    ep.phase,
    count(*) filter (where (ep.event_markers->>m.marker) = 'true') as fired_count,
    count(*) as total_events,
    case when count(*) > 0
         then round(100.0 * count(*) filter (where (ep.event_markers->>m.marker) = 'true') / count(*), 2)
         else 0 end as fire_rate_pct
  from marker_keys m
  cross join event_pool ep
  group by m.marker, ep.phase
  order by m.marker, ep.phase;
$$;

comment on function public.org_active_threat_pairs(uuid) is
  'Org-scoped clone of dashboard_active_threat_pairs. Returns one row per student with both pre+post active_threat completions for the given org.';
comment on function public.org_marker_aggregates(uuid) is
  'Org-scoped clone of dashboard_marker_aggregates. Returns 8 markers × pre/post fire rates filtered to the given org.';
