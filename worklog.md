# MVS Worklog

Append-only log of autonomous Claude Code sessions. Newest entries at the bottom.

---

## 2026-05-08 — Project planning (human + Claude in Cowork mode)

**What:** Reviewed doctor's 7 source documents (`Danny MVS_Document_1_Purpose`, `Document_2_Build_Spec`, `MVS LMS FULL PACKAGE`, `Data_Dictionary`, `Export_Schema`, `Test_Bank_Doctrine_Locked`, `Scenario_Bank_Doctrine_Locked`). Inventoried existing repo. Wrote project plan, working agreement, doctor open-items list, human open-items list, and Day 1 prompt.

**Inventory finding:** existing repo is much closer to doctrine than the docs implied. Quiz runner, branching, client-side reaction time, event-per-decision response logging, response-category taxonomy, admin dashboard, CSV export — all already built and doctrine-correct. The remaining work is *expansion*, not rebuild: add Supabase Auth + RLS + multi-tenancy + a multi-choice runner + email automation + marketing page.

**Architecture decisions locked:**
- Supabase Auth (magic link) + RLS for the multi-tenancy expansion
- `super_admin`, `org_admin`, `student` roles
- Invoice off-platform (no Stripe)
- Videos out of scope for v1 (handled separately)
- npm, not pnpm. Next 16, React 19, Tailwind 4.

**Created:**
- `CLAUDE.md` — working agreement
- `docs/MVS_Project_Plan.md` — full plan
- `docs/needs_doctor.md` — content gaps
- `docs/needs_human.md` — credential / setup gaps for Danny
- `docs/day1_prompt.md` — Day 1 Claude Code prompt

**Next session (Day 1):** wire Supabase Auth alongside the existing custom admin auth. Do not break `/mvs/admin`.

---

## 2026-05-08 — Day 1: Supabase Auth wired alongside legacy admin

**Branch:** `feat/supabase-auth`

**What shipped:**
- `supabase/migrations/0002_orgs_and_auth.sql` applied to project `pguqugmqyrjcwzkdzpel` (Active Threat). Adds `orgs`, `profiles`, indexes, `set_updated_at()` trigger, and an `auth.users` insert trigger that auto-creates a `profiles` row defaulting `role='student'`.
- `@supabase/ssr@0.10.3` installed.
- `src/lib/supabase/{server,client,middleware}.ts` — SSR client trio. `getAll`/`setAll` cookie methods (not deprecated `get`/`set`/`remove`). `cookies()` is `await`ed (Next 15+ async). `updateSession()` short-circuits when `NEXT_PUBLIC_SUPABASE_*` env vars are missing so legacy admin auth still works.
- `src/proxy.ts` — extended to call `updateSession()` on every matched request, then keep the legacy admin-session JWT gate. Matcher now broad (everything except static assets) so Supabase tokens refresh on real navigations.
- `src/app/auth/login/page.tsx` — magic-link form with sending/sent/error states.
- `src/app/auth/callback/route.ts` — exchanges code, looks up role from `profiles`, role-redirects (`/mvs/admin` | `/org` | `/app`). For super_admin it ALSO mints the legacy admin-session JWT so the existing `/mvs/admin` gate accepts them during the Day 1 → Day 2 coexistence window.
- `src/app/mvs/admin/login/page.tsx` — replaced custom login form with `redirect('/auth/login?next=/mvs/admin')`. Underlying `src/lib/session.ts` + `src/actions/auth.ts` left intact (Day 2 cuts them over).
- `next.config.ts` — already had legacy redirect, untouched.

**Next-16 note:** Day 1 prompt referenced `src/middleware.ts`. Next 16 renamed the file convention to `proxy.ts` (function `proxy`, not `middleware`). Reused the existing `src/proxy.ts`. Documented in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

**Subagent review (Phase F):** Independent reviewer confirmed (a) SSR pattern correct for Next 16, (b) proxy refresh ordering correct, (c) fresh server client per request. Flagged 4 issues, all fixed before commit:
1. Super_admin → `/mvs/admin` would have infinite-redirected (Supabase login but no admin-session JWT). Fix: callback now mints the legacy JWT for super_admin too.
2. `next` query-param had open-redirect risk (`//evil.com`). Fix: `isSafeNext()` validator.
3. `next=/mvs/admin` bypassed role check. Fix: only honour `next` if user role is allowed at the destination.
4. Profile lookup error was silently swallowed — failed users would route to `/app`. Fix: explicit error → bounce to `/auth/login?error=...`.

**Tests:**
- `npm run build` — green.
- Smoke (curl):
  - `GET /auth/login` → 200, "Send magic link" button present.
  - `GET /mvs/admin/login` → 307 → `/auth/login?next=/mvs/admin`.
  - `GET /mvs/admin` (no cookie) → 307 → `/mvs/admin/login`.
  - `GET /` (quiz) → 200.
- Magic-link end-to-end: not testable until anon key is provisioned (see `needs_human.md` #1).

**Blocked / handed off:**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` missing — full magic-link flow can't be exercised. Logged in `needs_human.md` #1 (was already there). Updated to also flag `NEXT_PUBLIC_SUPABASE_URL` for Vercel env vars.
- Once the anon key lands, run through `/auth/login` with a real email and confirm the callback role-routes correctly.

**Day 2 plan:**
- `0006_rls.sql`: real role-aware policies for all existing tables (replacing the `Service role full access` placeholders).
- Cut `/mvs/admin` over to Supabase Auth: drop the legacy `admin-session` JWT gate from `src/proxy.ts`, delete `src/lib/session.ts` and `src/actions/auth.ts`, remove the `createSession()` call from `auth/callback`.
- Tenant-leak audit via subagent.

**Post-commit, end-to-end verification (same day):**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` arrived in `.env.local`. Pushed to Vercel: URL in all 3 envs ✓; ANON_KEY in Production + Development ✓; Preview blocked by a `vercel env add ... preview --yes` CLI quirk (`git_branch_required` on the documented "all branches" form) — flagged to add via dashboard. Logged in `needs_human.md` #1.
- Stripped surrounding double quotes from the local `NEXT_PUBLIC_SUPABASE_ANON_KEY` value (Vercel CLI warned; dotenv would strip but kept it clean).
- Direct REST call to `/auth/v1/otp` returned 200 with the new key — Supabase auth wired correctly.
- Promoted `dannygreer@gmail.com` to `super_admin` via SQL (auto-created `profiles` row from the trigger confirmed working: `role=student` default, then updated).
- **End-to-end test:** form at `/auth/login` → magic link email → click → `/auth/callback?code=...` → super_admin role lookup → legacy JWT minted → landed on `/mvs/admin`. Works.
- First implicit-flow link (from the REST smoke test) confused the flow because it landed at `/#access_token=...` instead of `?code=`. Documented for future ref: always go through the form, not the REST endpoint, so `@supabase/ssr`'s default PKCE flow is used.

---

## 2026-05-08 — Day 2: RLS + admin auth cut over

**Branch:** `feat/rls-and-admin-cutover` (Day 1 already merged to main per Danny's call; Day 2 prompt's "stay on feat/supabase-auth" guidance superseded).

**Phase B — RLS:**
- `supabase/migrations/0003_rls.sql` applied. Replaces every "Service role full access" placeholder (except on legacy `quiz_results`) with role-aware policies.
- Helpers `auth_role()` and `auth_org()` are `SECURITY DEFINER` with fixed `search_path = public` to avoid RLS recursion when the super_admin policy on `profiles` calls back into the function.
- Strengthened `user update own profile` beyond the prompt's spec: blocks both `role` self-promotion AND `org_id` self-relocation (`is not distinct from` against the user's existing row).
- `tests/rls.spec.ts` — 14 vitest cases covering super_admin/org_admin/student tenant isolation, self-promotion attempt, cross-org reads, anonymous reads, scenario writes. All green on first run. `vitest` + `dotenv` added as devDeps; `vitest.config.ts` loads `.env.local`.

**Phase C — admin cut over:**
- `src/proxy.ts` — legacy admin-session JWT gate gone. `/mvs/admin/*` now requires authenticated Supabase user with `profiles.role = 'super_admin'` (one round-trip to `profiles`; uses the user's session via the anon-key client, allowed by the "user read own profile" RLS policy). Non-super_admins now route to their own portal (`/org` or `/app`) instead of bouncing back to login.
- `src/app/auth/callback/route.ts` — removed the `createSession()` shim that minted the legacy JWT for super_admins. Pure Supabase Auth from here.
- New helpers: `src/lib/auth.ts` (`getSuperAdmin()`, `requireSuperAdmin()`) for server actions and route handlers; `src/actions/session.ts` (`signOut()` server action).
- Migrated callers: `src/actions/admin.ts`, `src/actions/quiz.ts`, `src/app/api/admin/export-csv/route.ts`, `src/app/mvs/admin/page.tsx`.
- Deleted: `src/lib/session.ts`, `src/actions/auth.ts`, `src/components/admin/LoginForm.tsx`. Stripped from `.env.local`: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` — leaving them on Vercel until the merge to main lands so any unmerged preview deploys don't break.

**Smoke test:**
- Anon `GET /mvs/admin` → 307 to `/auth/login?next=%2Fmvs%2Fadmin` ✓
- Anon `GET /mvs/admin/orgs` → 307 to `/auth/login?next=%2Fmvs%2Fadmin%2Forgs` ✓
- `GET /mvs/admin/login` → 307 to `/auth/login?next=/mvs/admin` ✓
- `GET /auth/login` → 200 ✓
- `GET /` → 200 ✓
- Authenticated super_admin path: verified earlier in browser (existing dannygreer@gmail.com session). Browser re-test post-cutover by Danny pending.

**Phase D — subagent tenant-leak audit:** No blockers. Findings:
- (1) RLS policies sound; no cross-org leaks. `auth_role()`/`auth_org()` correctly scoped to `auth.uid()`.
- (2) Privilege escalation blocked. `user update own profile` policy locks both role and org_id.
- (3) Admin gate solid. **Observation:** `/api/admin/*` is not proxy-gated; only the in-route `getSuperAdmin()` check protects it (intentional, but future API routes need to remember). Logged for follow-up — not blocking Day 2.
- (4) Helper safety clean. SECURITY DEFINER + fixed search_path handles recursion correctly.
- (5) No stale legacy refs. Grep clean.
- (6) Non-super_admin redirect target now sensible (`/org`/`/app` instead of `/auth/login`). Updated post-audit.
- (7) Two `getUser()` round-trips per `/mvs/admin/*` request (proxy + middleware). Functional, defer optimization.

**Build green. RLS tests green (14/14).**

**Day 3 plan (per `MVS_Project_Plan.md`):**
- `0004_assessments_and_enrollments.sql`: `assessments`, `enrollments` tables.
- Backfill: default org for existing active-threat data.
- Admin UI: `/mvs/admin/orgs` list + create. Org detail page with roster + CRM-lite fields.
- Bulk-invite students (paste `name,email`). Creates profile + sends Supabase Auth magic-link invite.

**Vercel cleanup (post-merge):** remove `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` from all 3 envs in the Vercel dashboard.
