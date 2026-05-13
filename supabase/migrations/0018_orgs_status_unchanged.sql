-- 0018_orgs_status_unchanged.sql
-- A no-op restore of the original orgs.status vocabulary
-- (lead | active | completed | churned). An interim attempt to
-- simplify to just lead | active was applied to the live DB and then
-- reverted in the same session; this migration codifies the restored
-- constraint so a fresh DB rebuild lands in the same state.

alter table public.orgs drop constraint if exists orgs_status_check;
alter table public.orgs
  add constraint orgs_status_check
  check (status in ('lead', 'active', 'completed', 'churned'));

comment on column public.orgs.status is
  'Org lifecycle: lead | active | completed | churned.';
