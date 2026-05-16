-- 0021_weighted_markers.sql
-- Phase A of the Scully scoring-doctrine realignment.
--
-- Moves option markers from a boolean fire/no-fire model to the
-- INTEGER-WEIGHT model the Phase 1 Marker Assignment Doctrine + Report
-- Generation Logic require (e.g. escalation +3, drift +2, recovery -2;
-- recovery is negative = stabilizing).
--
-- `triggers_markers` / `event_markers` stay JSONB (no type change). They
-- now hold integers going forward: {"escalation": 3, "recovery": -2}.
-- Legacy boolean payloads ({"escalation": true}) remain readable via the
-- tolerant helpers below, so existing data + the fire-rate dashboard
-- keep working through the transition (only the disposable
-- sample_2026_05 seed has boolean event data; real options are empty).

-- 1. Per-option doctrine fields (Report Generation Logic §3.1).
alter table screen_options
  add column if not exists option_classification text,
  add column if not exists rationale text;
alter table mc_options
  add column if not exists option_classification text,
  add column if not exists rationale text;

-- 2. Tolerant accessors. marker_weight() reads a marker's integer
--    weight regardless of whether the JSON value is a legacy boolean,
--    a numeric, or absent. marker_fired() = nonzero weight (keeps the
--    legacy fire-rate semantics working on both old + new data).
create or replace function marker_weight(m jsonb, k text)
returns integer
language sql
immutable
as $$
  select case
    when m is null               then 0
    when (m ->> k) is null       then 0
    when (m ->> k) = 'true'      then 1
    when (m ->> k) = 'false'     then 0
    when (m ->> k) ~ '^-?[0-9]+$' then (m ->> k)::integer
    else 0
  end;
$$;

create or replace function marker_fired(m jsonb, k text)
returns boolean
language sql
immutable
as $$
  select marker_weight(m, k) <> 0;
$$;

-- 3. Recreate the fire-rate dashboard view to use marker_fired() so it
--    survives the boolean -> integer transition unchanged in output.
--    (Faithful copy of migration 0015 dashboard_marker_aggregates,
--    only the fired predicate swapped.)
create or replace view dashboard_marker_aggregates
with (security_invoker = true) as
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
   where rl.event_markers is not null
     and e.phase in ('pre','post')
)
select
  m.marker,
  ep.phase,
  count(*) filter (where marker_fired(ep.event_markers, m.marker)) as fired_count,
  count(*) as total_events,
  case when count(*) > 0
       then round(
         100.0 * count(*) filter (where marker_fired(ep.event_markers, m.marker))
         / count(*), 2)
       else 0 end as fire_rate_pct
from marker_keys m
cross join event_pool ep
group by m.marker, ep.phase
order by m.marker, ep.phase;
