-- 0003_rls.sql
-- Replace placeholder "service role full access" policies with role-aware ones.
-- Note: queries using SUPABASE_SERVICE_ROLE_KEY bypass RLS entirely (Supabase
-- default). These policies govern authenticated user clients (anon key + JWT
-- from Supabase Auth).

-- Helper functions. SECURITY DEFINER + a fixed search_path so the inner
-- profiles read isn't itself subject to RLS — otherwise the super_admin
-- policy on profiles would recurse into auth_role() which queries profiles.
create or replace function auth_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_org()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

-- ===== orgs =====
drop policy if exists "Service role full access" on orgs;
create policy "super_admin all on orgs"
  on orgs for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');
create policy "org_admin read own org"
  on orgs for select
  using (auth_role() = 'org_admin' and id = auth_org());
create policy "student read own org"
  on orgs for select
  using (auth_role() = 'student' and id = auth_org());

-- ===== profiles =====
drop policy if exists "Service role full access" on profiles;
create policy "super_admin all on profiles"
  on profiles for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');
create policy "org_admin read profiles in org"
  on profiles for select
  using (auth_role() = 'org_admin' and org_id = auth_org());
create policy "user read own profile"
  on profiles for select
  using (id = auth.uid());
create policy "user update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from profiles p2 where p2.id = auth.uid())
    and org_id is not distinct from (select org_id from profiles p3 where p3.id = auth.uid())
  );
-- ^ user cannot self-promote OR move themselves between orgs.

-- ===== scenarios / scenario_screens / screen_options =====
-- Content is read-by-authenticated, written-by-super_admin only.
do $$
declare t text;
begin
  for t in select unnest(array['scenarios','scenario_screens','screen_options']) loop
    execute format('drop policy if exists "Service role full access" on %I', t);
    execute format(
      'create policy "super_admin all on %1$s" on %1$I for all using (auth_role() = ''super_admin'') with check (auth_role() = ''super_admin'')',
      t
    );
    execute format(
      'create policy "authenticated read on %1$s" on %1$I for select using (auth.uid() is not null)',
      t
    );
  end loop;
end$$;

-- ===== response_tags =====
drop policy if exists "Service role full access" on response_tags;
create policy "super_admin all on response_tags"
  on response_tags for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');
create policy "org_admin read response_tags"
  on response_tags for select
  using (auth_role() = 'org_admin');
-- students do not need access; they don't see tagging.

-- ===== responses_long / responses_wide =====
-- These tables don't yet have student_id / org_id columns
-- (added in 0005_link_responses_to_enrollments.sql, Day 4-5).
-- Until then only super_admin gets RLS access; org_admin/student access
-- continues via service-role driven app paths.
drop policy if exists "Service role full access" on responses_long;
drop policy if exists "Service role full access" on responses_wide;
create policy "super_admin all on responses_long"
  on responses_long for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');
create policy "super_admin all on responses_wide"
  on responses_wide for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');

-- ===== quiz_results (legacy) =====
-- Untouched. Stays service-role-only; admin dashboard still reads it.
