-- 0006_widen_phase_check.sql
-- Day 4 audit caught a CHECK constraint mismatch: responses_long.phase and
-- responses_wide.phase only allow 'pre'|'post', but enrollments.phase allows
-- 'practice'. Submitting a practice enrollment would crash on insert.
-- Widen both constraints to match the enrollment.phase enum.

alter table responses_long drop constraint if exists responses_long_phase_check;
alter table responses_long
  add constraint responses_long_phase_check
  check (phase in ('pre','post','practice'));

alter table responses_wide drop constraint if exists responses_wide_phase_check;
alter table responses_wide
  add constraint responses_wide_phase_check
  check (phase in ('pre','post','practice'));
