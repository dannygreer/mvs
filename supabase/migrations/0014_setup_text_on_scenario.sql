-- 0014_setup_text_on_scenario.sql
-- Promote scenario setup/context text from per-screen duplication to a
-- single scenario-level column. Recognition-test scenarios (Phase 1 Freeze
-- content seeded by 0012/0013 era seeds) repeat the same setup across 4
-- questions; storing it 4× is wasteful and confuses the admin builder
-- preview (all 4 rows look identical).
--
-- Active-threat (scenario_id = 'active_threat_v1') is INTENTIONALLY left
-- alone — its per-screen text evolves the branching narrative and IS the
-- doctrine-locked content.

alter table scenarios add column if not exists setup_text text;

-- screen_text was originally NOT NULL; the 5 Phase 1 Freeze scenarios that
-- promote their setup to scenarios.setup_text don't need per-screen text,
-- so we relax the column-level constraint to allow null.
alter table scenario_screens alter column screen_text drop not null;

-- Replace the lost guarantee with a cross-table invariant: a screen MAY
-- have null screen_text ONLY if its parent scenario carries setup_text.
-- Active-threat (no setup_text) is forced to keep its per-screen narrative;
-- recognition-test scenarios (setup_text set) are allowed to null screen_text.
create or replace function scenario_screen_text_invariant() returns trigger
language plpgsql as $$
declare
  parent_setup_text text;
begin
  select setup_text into parent_setup_text from scenarios where id = new.scenario_fk;
  if parent_setup_text is null
     and (new.screen_text is null or new.screen_text = '') then
    raise exception 'scenario_screens.screen_text is required when the parent scenario has no setup_text (scenario_fk=%, screen_id=%)', new.scenario_fk, new.screen_id;
  end if;
  return new;
end;
$$;

drop trigger if exists scenario_screen_text_invariant_t on scenario_screens;
create trigger scenario_screen_text_invariant_t
  before insert or update on scenario_screens
  for each row execute function scenario_screen_text_invariant();

-- Backfill: for each Phase 1 Freeze scenario, copy Q1's screen_text up to
-- the parent scenario's new setup_text column.
update scenarios s
   set setup_text = sub.screen_text
  from (
    select scr.scenario_fk, scr.screen_text
      from scenario_screens scr
      join scenarios sc2 on sc2.id = scr.scenario_fk
     where sc2.scenario_id in (
       'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
       'team_velocity_v1','recovery_drift_v1'
     )
       and scr.sort_order = 1
  ) sub
 where s.id = sub.scenario_fk
   and s.setup_text is null;

-- Null out the redundant per-screen text on the 5 scenarios.
update scenario_screens scr
   set screen_text = null
  from scenarios s
 where s.id = scr.scenario_fk
   and s.scenario_id in (
     'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
     'team_velocity_v1','recovery_drift_v1'
   );

-- Sanity check: every Phase 1 Freeze scenario has setup_text populated AND
-- zero of its screens carry non-null screen_text. Raises on regression.
do $$
declare
  missing_setup int;
  stray_text int;
begin
  select count(*) into missing_setup from scenarios s
   where s.scenario_id in (
     'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
     'team_velocity_v1','recovery_drift_v1'
   )
     and (s.setup_text is null or s.setup_text = '');
  if missing_setup > 0 then
    raise exception 'Setup text backfill failed: % scenarios have null setup_text', missing_setup;
  end if;

  select count(*) into stray_text from scenario_screens scr
   join scenarios s on s.id = scr.scenario_fk
   where s.scenario_id in (
     'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
     'team_velocity_v1','recovery_drift_v1'
   )
     and scr.screen_text is not null;
  if stray_text > 0 then
    raise exception 'screen_text not nulled correctly: % rows still have text', stray_text;
  end if;
end$$;
