-- 0016_orgs_session_date.sql
-- Adds the scheduled training session date to orgs. Headline column on
-- /mvs/admin/orgs (replaces "Created" in the table) and an editable field
-- on the org detail page. Nullable since orgs may not have a date set yet.

alter table public.orgs add column if not exists session_date date;

comment on column public.orgs.session_date is
  'Scheduled training session date for the org. Surfaces in /mvs/admin/orgs as the headline when-are-they-running-it column.';
