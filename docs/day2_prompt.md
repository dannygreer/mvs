# Day 2 Prompt — paste this into Claude Code (cwd = repo root)

You're working on the Mental Velocity System (MVS) LMS. Day 1 shipped Supabase Auth (magic link) alongside the legacy username/password admin auth — both work today, with `auth/callback` minting the legacy admin-session JWT for super_admins so `/mvs/admin` accepts them. **Today (Day 2) we cut the cord on the legacy auth and turn on real RLS.**

Read these in order before any code:
1. `AGENTS.md` (Next.js 16 quirks — remember it's `src/proxy.ts`, not `middleware.ts`)
2. `CLAUDE.md` (working agreement, doctrine, autonomous-mode rules)
3. `docs/MVS_Project_Plan.md`
4. `worklog.md` — read the Day 1 entry; you'll be touching the same files
5. `docs/needs_human.md`

You are running with `--dangerously-skip-permissions`. Plan to work autonomously for **2-3 hours**. Follow autonomous-mode rules: don't stop to confirm, log blockers to `docs/needs_human.md`, append to `worklog.md`, commit at every working chunk, push at the end.

## Branch
Continue on `feat/supabase-auth`. Don't merge to `main` until Day 2 acceptance passes — the auth refactor is one coherent change and ships as one PR.

## Scope today: RLS + legacy auth removal

Two things, in this order. **Do RLS first** so the DB is secure before we make the cutover irreversible.

### Phase A — Verify foundation (~10 min)
1. `git status` — confirm branch, no uncommitted junk.
2. `npm run build` — must currently pass.
3. `git pull` (in case you're picking up after a teammate or another session).
4. Confirm `.env.local` still has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. If any are missing, log to `needs_human.md` and stop.
5. Sanity check Day 1 still works: `npm run dev` → `GET /auth/login` returns 200, `GET /mvs/admin/login` redirects to `/auth/login?next=/mvs/admin`.

### Phase B — RLS policies (~60 min)

The current policies on every existing table are placeholder `Service role full access` from Day 0. Replace them with role-aware policies. Service role still bypasses RLS automatically (Supabase default), so service-role queries from `src/lib/db.ts` continue to work — RLS becomes the enforcement layer for authenticated-user clients (which Days 4+ will introduce for org_admin and student portals).

Create `supabase/migrations/0003_rls.sql`:

```sql
-- 0003_rls.sql
-- Replace placeholder "service role full access" policies with role-aware ones.
-- Note: queries using SUPABASE_SERVICE_ROLE_KEY bypass RLS entirely (Supabase default).
-- These policies govern authenticated user clients (anon key + JWT from Supabase Auth).

-- Helper: current user's profile role + org
create or replace function auth_role() returns text language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_org() returns uuid language sql stable as $$
  select org_id from profiles where id = auth.uid()
$$;

-- ===== orgs =====
drop policy if exists "Service role full access" on orgs;
create policy "super_admin all on orgs"   on orgs for all    using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');
create policy "org_admin read own org"    on orgs for select using (auth_role() = 'org_admin' and id = auth_org());
create policy "student read own org"      on orgs for select using (auth_role() = 'student'   and id = auth_org());

-- ===== profiles =====
drop policy if exists "Service role full access" on profiles;
create policy "super_admin all on profiles"      on profiles for all    using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');
create policy "org_admin read profiles in org"   on profiles for select using (auth_role() = 'org_admin' and org_id = auth_org());
create policy "student read own profile"         on profiles for select using (id = auth.uid());
create policy "student update own profile"       on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
-- ^ student cannot self-promote: role must equal their existing role.

-- ===== scenarios / scenario_screens / screen_options =====
-- Content is read-by-everyone, written-by-super_admin only.
do $$
declare t text;
begin
  for t in select unnest(array['scenarios','scenario_screens','screen_options']) loop
    execute format('drop policy if exists "Service role full access" on %I', t);
    execute format('create policy "super_admin all on %1$s" on %1$I for all using (auth_role() = ''super_admin'') with check (auth_role() = ''super_admin'')', t);
    execute format('create policy "authenticated read on %1$s" on %1$I for select using (auth.uid() is not null)', t);
  end loop;
end$$;

-- ===== response_tags =====
drop policy if exists "Service role full access" on response_tags;
create policy "super_admin all on response_tags"  on response_tags for all using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');
create policy "org_admin read response_tags"      on response_tags for select using (auth_role() = 'org_admin');
-- students do not need access; they don't see tagging.

-- ===== responses_long / responses_wide =====
-- These tables don't yet have student_id / org_id columns (added in Day 4-5 migration).
-- Until then, only super_admin gets RLS access. Org_admin / student access is
-- gated by the existing service_role-driven app paths and will get proper RLS
-- in 0005_link_responses_to_enrollments.sql.
drop policy if exists "Service role full access" on responses_long;
drop policy if exists "Service role full access" on responses_wide;
create policy "super_admin all on responses_long" on responses_long for all using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');
create policy "super_admin all on responses_wide" on responses_wide for all using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');

-- ===== quiz_results (legacy) =====
-- Untouched. Stays service-role-only; admin dashboard still reads it.
-- (Leave the existing policy in place.)
```

Apply via `npx supabase db push` (or SQL editor fallback if CLI auth has issues — log either way).

After applying, write `tests/rls.spec.ts` (or whatever Next 16 wants for tests — vitest is fine):
- Three test users (one per role) created via the service-role admin SDK.
- For each, instantiate an authenticated supabase-js client and assert what they can/can't read/write.
- At minimum 8 cases: super_admin reads all orgs ✓, org_admin reads own org ✓, org_admin reads other org ✗, student reads own profile ✓, student reads other profile ✗, student promotes self ✗, anon reads scenarios ✗, super_admin writes scenario ✓.

Run tests until green. **If a policy is wrong, fix the migration file and re-apply** — don't add a `0004_rls_fix.sql`. The migration should be authoritative.

### Phase C — Cut over `/mvs/admin` to pure Supabase Auth (~45 min)

The legacy auth has three pieces:
1. `src/lib/session.ts` — JWT helpers (`getSession`, `createSession`, `clearSession`).
2. `src/actions/auth.ts` — server actions (`login`, `logout`).
3. `src/proxy.ts` — checks for the legacy `admin-session` cookie on `/mvs/admin/*` requests.

Plus the Day 1 coexistence shim: `src/app/auth/callback/route.ts` mints the legacy JWT for super_admins so `/mvs/admin` accepts them.

Cutover steps:
1. **In `src/proxy.ts`:** remove the legacy admin-session JWT gate. Replace with a Supabase Auth check: get the user via `updateSession()` (already wired), then for `/mvs/admin/*` paths verify the user is authenticated AND `profiles.role = 'super_admin'`. If not, redirect to `/auth/login?next=<path>`. Use a small server-side fetch to `profiles` (the proxy needs the service role client for this — or cache role in the Supabase JWT via a custom claim trigger; for now, use service role lookup. Optimize later.)
2. **In `src/app/auth/callback/route.ts`:** remove the `createSession()` call for super_admin. The proxy now does the role check on its own.
3. **Delete:** `src/lib/session.ts` and `src/actions/auth.ts`.
4. **Delete env vars:** `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` from `.env.local` and Vercel (mark deleted in `worklog.md`). Don't actually delete from Vercel until merged to main — leave them sitting unused. But scrub them from `.env.example` if present.
5. **Update any imports** that referenced the deleted files (`grep -r "lib/session" src/` and `grep -r "actions/auth" src/`).
6. **Test the cutover:**
   - `npm run dev`
   - In an incognito window, hit `/mvs/admin` → should redirect to `/auth/login?next=/mvs/admin`.
   - Sign in with `dannygreer@gmail.com` (super_admin) → magic link → should land on `/mvs/admin` with full dashboard.
   - Sign in with a non-super_admin user (create a test student via SQL: `insert into profiles (id, role) values ((select id from auth.users where email = 'test+student@yourdomain.com'), 'student')`) → magic link → should land on `/app` (which 404s today, that's fine — confirms role routing works).
   - Confirm the existing admin tabs (Summary, Responses, ScenarioBuilder, ResponseTagging, CSV export) still render and load real data.

### Phase D — Tenant-leak audit via subagent (~20 min)

Launch a Task with this brief:

> Independently audit the RLS policies on branch `feat/supabase-auth` against `supabase/migrations/0003_rls.sql` and the actual schema. Specifically: (1) is there any path by which an org_admin in org A could read rows belonging to org B from any table? (2) is there any path by which a student could read another student's profile, enrollments, or response data? (3) is there any path by which an authenticated user could promote themselves to a higher role via the `profiles` update policy? (4) does the `/mvs/admin` proxy gate correctly reject a logged-in non-super_admin trying to hit `/mvs/admin/orgs` directly? Report findings with file:line references.

Address whatever it flags before the final commit.

### Phase E — Stop cleanly (~15 min)

1. Append `worklog.md` entry: what cutover changed, what RLS now enforces, what's still service-role-only and why, subagent findings, what Day 3 will do (orgs UI + bulk student invite).
2. Update `docs/needs_human.md` resolved section: legacy admin env vars can be removed from Vercel after merge.
3. `npm run build` — must pass.
4. Commit: `feat: cut /mvs/admin to Supabase Auth + add real RLS policies`.
5. Push the branch.
6. Print chat summary with: the cutover diff, RLS test results, subagent findings, Day 3 plan.

**Do NOT** start Day 3 today. Stop after Day 2 acceptance.

## Day 2 acceptance criteria
- `0003_rls.sql` applied; placeholder `Service role full access` policies replaced everywhere except `quiz_results`.
- RLS test suite green (≥8 cases covering tenant isolation + role escalation).
- `src/lib/session.ts`, `src/actions/auth.ts`, and the `createSession()` call in `auth/callback` are deleted.
- `src/proxy.ts` no longer references the legacy admin-session cookie; `/mvs/admin/*` is gated by Supabase Auth + `super_admin` role lookup.
- Magic-link login as `dannygreer@gmail.com` lands on `/mvs/admin` with all existing admin functionality intact.
- Non-super_admin users cannot reach `/mvs/admin/*` even by direct URL.
- Subagent tenant-leak audit findings addressed and recorded in `worklog.md`.
- `npm run build` passes; branch pushed.

## Things to watch
- **Service role still bypasses RLS.** The admin dashboard at `/mvs/admin` continues to use `src/lib/db.ts` which uses the service role key. That's fine — the route is auth-gated by the proxy. Just be aware the policies don't constrain that path.
- **Don't break the existing admin.** All four admin tabs (Summary, Responses, ScenarioBuilder, ResponseTagging) and the CSV export need to still work. Manual smoke check after the cutover.
- **The Vercel preview env still missing the anon key** (per `needs_human.md` #1). This means preview deploys of the auth flow will be broken. Not blocking Day 2 work — but tests against preview URLs will fail until the dashboard fix lands.

Go.
