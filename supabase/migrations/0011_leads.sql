-- 0011_leads.sql
-- Marketing-form leads. Anyone (including unauthenticated visitors) can
-- INSERT a row via the contact form. Only super_admin can SELECT, UPDATE,
-- DELETE — split-policy pattern so anon submissions don't leak read access.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organization text,
  organization_type text
    check (organization_type in ('hospital','police','defense','other')
        or organization_type is null),
  message text,
  source text not null default 'marketing_form',
  status text not null default 'new'
    check (status in ('new','contacted','qualified','converted','dropped')),
  created_at timestamptz not null default now()
);
create index if not exists leads_status_created_idx on leads(status, created_at desc);

alter table leads enable row level security;

-- Super admin: full read/write/manage.
create policy "super_admin all on leads"
  on leads for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');

-- Anonymous AND authenticated form submissions: insert only.
-- The with-check is unconditional (the action validates payload server-side)
-- and there's NO matching select/update/delete policy for non-super_admins,
-- so insert is the only operation any non-super_admin can perform.
create policy "anyone insert lead"
  on leads for insert
  with check (true);
