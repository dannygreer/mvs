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

---

## 2026-05-08 — Day 3: orgs admin UI + bulk-invite students

**Branch:** `feat/orgs-and-invite` (cut from `feat/rls-and-admin-cutover` because Day 2 isn't yet merged to main).

**Phase B — migration 0004:**
- `supabase/migrations/0004_assessments_and_enrollments.sql` applied. Adds `assessments` (umbrella for scenario + multi-choice) and `enrollments` (student × assessment × phase). RLS + indexes per spec. Active-threat scenario backfilled as `assessments.code = 'active_threat_v1'`.
- **Recursion gotcha:** the spec's `student complete own enrollment` policy uses a WITH CHECK subquery against the same row to lock immutable fields (student_id/assessment_id/phase) — Postgres errored "infinite recursion in policy for relation enrollments". Fixed in-place by replacing the WITH CHECK subquery with a `BEFORE UPDATE` trigger (`lock_enrollment_immutable_fields`) that pins those columns for non-super_admin updates. Trigger is SECURITY DEFINER + fixed `search_path = public`.
- 4 new vitest cases added; full suite now 18/18 green.

**Phase C — orgs admin UI:**
- `/mvs/admin/orgs` (list with student count, status pill, deal value). `/mvs/admin/orgs/new` (create form). `/mvs/admin/orgs/[id]` (detail with editable CRM card + read-only roster joining `auth.users` for email + completed-enrollment count).
- New helpers in `src/lib/db.ts`: `listOrgs`, `getOrg`, `insertOrg`, `updateOrgRow`, `getOrgRoster`, plus `OrgRow`/`OrgListItem`/`OrgRosterRow`/`OrgInput` types. JSDoc warning that all helpers use service role and bypass RLS — callers must enforce authz.
- Server actions `createOrg` / `updateOrg` in `src/actions/orgs.ts`, both gated by `requireSuperAdmin()`.
- New shared `OrgForm` component + Orgs nav link wired into the admin header.

**Phase D — bulk invite + /app placeholder:**
- `/mvs/admin/orgs/[id]/invite` page with textarea + per-row result table (client component using `useActionState`).
- `inviteStudents(prev, formData)` server action: parses `First,Last,email` lines, validates email, calls `auth.admin.inviteUserByEmail` with `redirectTo = ${APP_URL}/auth/callback?next=/app`, defensively `upsert`s `profiles` (handles trigger lag for new users + existing users), and **does not silently overwrite** when an existing user already belongs to a different org — surfaces as `conflict_other_org`.
- Hard cap of 200 rows per submission (Vercel function timeout headroom; subagent flagged 5000-row pasted scenario as risk).
- `/app` placeholder route ships now (Day 4 will populate it). Auth-gated; renders only the user's own email.

**Phase E — subagent audit:** No exploitable issues. Action items addressed pre-commit:
1. ✅ 200-row cap on `inviteStudents` (was unbounded → would hang on large pastes).
2. ✅ JSDoc warning on `db.ts` orgs helpers about service-role + caller-side authz requirement.

Deferred (cosmetic / future): TOCTOU window in conflict check (single-admin model OK), faster email→user_id lookup (Supabase admin SDK has no direct endpoint), re-submit re-invites no idempotency guard.

**Live test (browser):**
- Created "Day 3 Test Org" (id `bdacf849-...`) via SQL.
- Invited `dannygreer+s1/s2/s3@gmail.com` via the UI:
  - s1 → ✅ invited (email arrived, profile.org_id linked, `email_confirmed_at` set after click).
  - s2/s3 → ❌ "email rate limit exceeded" — Supabase default SMTP caps ~3-4 emails/hour. **Not a code bug; this is the Day 7 Resend migration's problem.** Logged.
- Clicked invite link → landed at `/auth/login?error=missing_code#error=access_denied&error_code=otp_expired`. The token WAS verified (DB shows email_confirmed_at populated 38s after invite) — the "expired" likely came from a second hit (Gmail prefetch / refresh) consuming the already-used token. Resend (Day 7) fixes this; not a code bug.
- Conflict path: moved s1 to a second test org via SQL, asked user to invite s1 to original org. Expected `conflict_other_org` amber status (no overwrite). Result pending user verification.

**Day 4 plan (per `MVS_Project_Plan.md`):**
- Light up `/app` with the student's `enrollments` list (button per phase to launch the `Quiz` runner).
- On completion, write `enrollments.completed_at` AND link `responses_long`/`responses_wide` rows to `enrollment_id` + `student_id` (requires `0005_link_responses_to_enrollments.sql`).
- `submitAssessment` server action gets a real auth check (currently anonymous-by-design for the legacy quiz).

**Open items now blocking polish, not blocking dev:**
- Default Supabase SMTP rate limit + invite-link prefetch issue. **Recommend pulling Day 7 (Resend) up before Day 6** so the first cohort's invites are reliable.

---

## 2026-05-09 — Day 4: student portal + enrollment-linked response capture

**Branch:** `feat/student-portal` (cut from `feat/orgs-and-invite` because Days 2+3 still unmerged).

**Phase B — migration 0005 + 0006:**
- `supabase/migrations/0005_link_responses_to_enrollments.sql` applied. Adds nullable `enrollment_id` + `student_id` columns to `responses_long` and `responses_wide` (+ indexes). Layers RLS: student insert/select-own (DB-level guard), org_admin read-in-org. Existing legacy/anonymous rows preserved untouched.
- **Subagent caught a CHECK constraint mismatch** during review: existing `responses_long.phase` and `responses_wide.phase` constraints only allow `'pre'|'post'`, but `enrollments.phase` (added in 0004) allows `'practice'`. Submitting a practice enrollment would crash on insert. Added `0006_widen_phase_check.sql` to widen both constraints to match.
- Added 4 new RLS test sub-assertions (across 2 cases) for student-insert-own / cross-student-blocked / org_admin-scoped reads. Full suite now 24/24 green.

**Phase C — student portal:**
- `requireStudent(currentPath)` helper in `src/lib/auth.ts` redirects super_admin→`/mvs/admin`, org_admin→`/org`, anon→`/auth/login?next=...`. Returns `{user, profile}` for students. Static-imports `redirect` from `next/navigation` so TS sees the never return.
- `/app/layout.tsx` — minimal header (display name + sign-out).
- `/app/page.tsx` — server component, RLS-gated authenticated client. Lists enrollments split into Assigned (Start button) and Completed (green Done badge). Empty state for new students.
- `/app/take/[enrollmentId]/page.tsx` — RLS-gated read of enrollment + assessment + scenario. Defensive `notFound()` on wrong student. Redirect-to-`/app?notice=already_completed` when already done. Mounts `<Quiz>` with prefilled identity. Multi-choice path returns a `[NEEDS_DAY_5]` placeholder so we don't crash before Day 5.

**Phase D — Quiz wiring:**
- `Quiz.tsx` extended with optional `enrollmentId` / `studentId` / `prefillFirstName` / `prefillLastName` / `prefillPhase` props. When `enrollmentId` is set, initial step is `'reading'` (title screen skipped) and identity comes from props. **`ScenarioScreen.tsx` and reaction-time capture untouched.**
- `submitAssessment` server action validates enrollment ownership and not-already-completed. **studentId is now derived from the authenticated session (`createSessionClient().auth.getUser()`), not the client-supplied prop** — the prop is treated as untrusted.
- Atomic completion gate: `update enrollments set completed_at = now() where id = $1 and completed_at is null returning id`. Race losers throw `ENROLLMENT_ALREADY_COMPLETED` rather than silently overwriting.
- New `getScenarioById` in `src/lib/db.ts` (with private `loadScenarioFromRow` shared with `getActiveScenario`).
- Phase type widened to `'pre' | 'post' | 'practice'`. `Phase` flows through `submitAssessment` → CHECK constraint (now widened by 0006).

**Phase E — subagent audit:** Caught 3 critical issues, ALL fixed pre-commit:
1. ✅ **studentId trust violation** — server now derives studentId from session via `createSessionClient`, never trusts the client-supplied prop. Without this fix, a logged-in attacker who knew `(victim_enrollment_id, victim_user_id)` could close the victim's enrollment.
2. ✅ **Race condition on completion** — atomic `update ... where completed_at is null returning id` with `ENROLLMENT_ALREADY_COMPLETED` thrown on empty result.
3. ✅ **Phase CHECK mismatch** — added migration 0006 widening both response tables.

Lower-severity findings logged but not addressed in this session: partial-failure between long+wide inserts (no transaction), unused `?notice=` query param in `/app`, sub-select scan in org_admin RLS policy at scale. None blocking.

**Phase F — end-to-end test (browser, real enrollment):**
- Magic-link email round trip blocked again by Gmail prefetch consuming the OTP token (same Day 3 issue). Routed around with a temporary `/dev/login-as` route (NODE_ENV-gated, localhost-only) that mints a session via admin SDK + `verifyOtp(token_hash)`. Route deleted after test.
- Signed in as `dannygreer+s1@gmail.com` → landed on `/app` → saw the active-threat enrollment under Assigned → clicked Start → completed all 6 screens → submission succeeded.
- DB verification:
  - `enrollments.completed_at` = `2026-05-09T21:18:11.906+00:00` ✅
  - 6 rows in `responses_long` (one per decision), all with correct `enrollment_id` + `student_id` (= session user id) ✅
  - 1 row in `responses_wide` with branch_path `C-D-C-A-B-C` and `total_time` 22161ms ✅
  - RTs: 1433ms–5745ms range, all plausible client-side captures ✅
  - `response_category` is null because `response_tags` for the active-threat scenario aren't populated yet (content gap, already in `needs_doctor.md`).

**Day 5 plan (per `MVS_Project_Plan.md`):**
- Build `src/components/quiz/McRunner.tsx` mirroring the doctrine-locked event pattern — single question per screen, client-side RT, no back button, one `responses_long` row per answer.
- `0007_multi_choice.sql`: `mc_questions` + `mc_options` tables.
- Seed the 50-question Test Bank (with `[NEEDS_DOCTOR]` placeholders for `is_correct` until the doctor delivers the answer key).
- Update `/app/take/[id]` to dispatch by `assessment.kind`: scenario → existing Quiz, multi_choice → McRunner.
- Admin response views grouped by assessment kind.

**Cleanup queued for the merge to main:**
- Move legacy admin env vars (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`) off Vercel. Already off `.env.local` (Day 2).
- Resend SMTP swap (was Day 7; recommend before Day 6 because invite-link UX is currently broken on Gmail).

---

## 2026-05-09 — Day 5: multi-choice runner + Test Bank + token-URL student auth pivot

**Branch:** `feat/multi-choice-runner` (cut from `feat/student-portal`).

**What shipped:**

### Multi-choice (per Day 5 prompt)
- `0007_multi_choice_test.sql` applied (re-numbered from 0006 because that slot was taken by Day 4's widen_phase_check). Adds `mc_questions` + `mc_options` with RLS. Authenticated users can read content for active assessments only — but the `is_correct` column lives on `mc_options` and the policy doesn't strip it, so the application-layer loader is the gate.
- Real Test Bank seed at `supabase/seeds/mc_test_bank_v1.sql` applied: 50 questions + 200 options + answer key + integrity check. Active threat continues to coexist as a second active assessment.
- `loadMcQuestionsForStudent` in `src/lib/db.ts` projects only `id, label, text` — never `is_correct` or `response_category`. New vitest case asserts the loader contract.
- `src/components/quiz/McRunner.tsx` mirrors the doctrine-locked AnswerScreen reaction-time pattern (`useRef(Date.now())` at mount, `answeredRef` debounce, no back/Next/progress UI, parent-controlled auto-advance via re-key).
- `src/components/quiz/McQuiz.tsx` shell handles in_progress / submitting / results / error states. Skips title screen entirely.
- `submitMcAssessment` server action: same trust model as scenario submit (studentId from session, ownership + non-completion + atomic completion gate), plus content-integrity validation that every (questionId, optionId, optionLabel) triple actually belongs together.
- `0006_widen_phase_check.sql` — wait, that's Day 4. Day 5 also added `0008_responses_long_unique_per_question.sql` (partial unique index on `(enrollment_id, question_id) where enrollment_id is not null`) to close the race-loser data poisoning gap the Day 4 audit flagged but deferred.
- 25 vitest cases including 5 new MC ones and the loader-contract leak test. All green.

### Subagent audit (clean, with 3 items addressed pre-commit):
1. ✅ MC submission validates content integrity (questionId/optionId/label cross-check).
2. ✅ `(enrollment_id, question_id)` unique index added in 0008.
3. ✅ MC long-format CSV rows now carry first/last name from profile (was empty).
Plus deferred: assessment-level "MC results in admin" UX (Responses tab is wide-table only and MC writes only long), MC tagging UI (NEEDS_DOCTOR #3).

### Token-URL student auth pivot (Phase K, replacing Day 5 prompt's email/OTP plan)
- Why: tried OTP code login as a fix for Gmail prefetch consuming magic-link tokens. Server-side verifyOtp consistently failed with "token expired or is invalid" — Supabase's @supabase/ssr server client uses PKCE flow even without `emailRedirectTo`, storing the token under a key that verifyOtp({type:'email'}|'magiclink') doesn't recognize. After several rounds of debugging (and confirming SMTP+Resend wiring is correct), pivoted: students don't authenticate at all.
- `0009_enrollment_secret_token.sql` — adds `secret_token uuid not null default gen_random_uuid() unique` to enrollments. Backfill is implicit via the default.
- `/take/[token]/page.tsx` — server component, no auth required. Looks up enrollment by token via service-role client. Renders Quiz or McQuiz. Shows "Already submitted" page on revisit.
- `submitAssessmentByToken` and `submitMcAssessmentByToken` — derive enrollment, student, phase, and identity from the token server-side. Same atomic completion gate.
- Quiz.tsx + McQuiz.tsx accept optional `token` prop. When present, submission goes through the byToken actions instead of the auth-mode actions.
- `EnrollmentLinks` component on org detail page — clickable badges per enrollment phase that copy the take URL to clipboard. Completed enrollments show struck-through.
- `/auth/login` reverted from short-lived OTP variant back to admin-only magic-link form (with the known Gmail-prefetch caveat — admins click in same browser session as initiation; works in practice).

### Resend SMTP setup (Phase I, partial)
- Custom SMTP wired to Resend Pro account: `smtp.resend.com:587`, sender `onboarding@resend.dev`, name "MVS". Subject template uses `{{ .Token }}`.
- Sandbox restriction: only delivers to email tied to Resend account (dannygreer@gmail.com + plus-aliases). Sufficient for dev. **Hard blocker for cohort**: must verify a real domain (e.g. `mail.mentalvelocitysystem.com`) before any non-Danny student gets emailed. With the token-URL pivot, students don't get emailed at all — but admin sign-in still flows through Supabase Auth + Resend, and the doctor (and any future org_admins) need to be reachable.
- Recommend in next session: domain verification at Resend, swap sender email, also disable Click Tracking in Resend if you don't need it (cleaner email bodies).

**Tests:** 29/29 vitest cases green throughout the day.

**Live verification (token-URL flow):**
- Created two practice enrollments for dannygreer+s1@gmail.com (one scenario, one MC).
- Pasted both /take/[token] URLs into a fresh browser tab (no auth, no incognito).
- Scenario: 6 responses_long rows, completed_at stamped, first_name "Test" populated, RTs 466–733ms.
- MC: 50 responses_long rows, completed_at stamped, first_name "Test" populated, RTs 2–2564ms (the 2ms = rapid speed-test click).
- "Already submitted" page renders on revisit. ✅

**Day 6 plan (per `MVS_Project_Plan.md`):**
- Build `/org` portal for org_admin role: read-only roster + aggregate scores for their org.
- RLS guarantees isolation; existing `org_admin read enrollments in org` policy from 0004 covers it.
- Plus: tighten roster UI to label take-link badges by assessment code (Day 5b deferred this).

**Open items:**
- Resend domain verification (backlog blocker before cohort).
- Bulk-invite UX needs reconsideration: do we still send emails (auth.admin.inviteUserByEmail) when the actual delivery channel is the doctor handing out URLs? Probably switch to `auth.admin.createUser` (no email) and surface the URLs in the admin UI. Day 6 candidate.
- `/app/take/[enrollmentId]` (Day 4 auth path) is still wired but largely supplanted by `/take/[token]`. Keep it for now as a back-door for authenticated student testing; deprecate when student portal is removed.

---

## 2026-05-09 — Day 6: org admin portal + scoring view + invite-org-admin UI

**Branch:** `feat/org-admin-portal` (cut from `feat/multi-choice-runner`).

**What shipped:**

### Migration 0010 — enrollment_scores + org_assessment_rollup views
- Two read-only views computing per-enrollment score (correct/total/percent/pass) and per-org rollup (enrolled/completed/passed/avg-score/avg-time).
- **CRITICAL** `security_invoker = true` on both views. Default Postgres views run as the owner (postgres = bypasses RLS) — without this an org_admin could read every other org's enrollments via the view. Confirmed via vitest: `org_admin sees only own org` initially failed (got both rows), passed after the security_invoker setting.
- MC question_id join handles Day 5's `q01..q50` storage format by stripping the leading `q` before casting to int and matching `mc_questions.sequence`.
- Added 2 vitest cases: cross-org isolation via the view, and 80%-rubric pass math correctness (boundary case + below-boundary). All 27 tests green.

### inviteOrgAdmin server action + UI
- `/mvs/admin/orgs/[id]` got a new "Org admins" section above the (now student-only) roster.
- `inviteOrgAdmin` action: validates email, refuses to demote a super_admin, surfaces conflict if user already in different org. New `promoted_student` status surfaces when an existing student in the same org gets promoted (subagent flagged silent promotion as a UX risk).
- `InviteOrgAdminForm` client component with status badge feedback.

### /org portal
- `requireOrgAdmin(currentPath)` helper. Redirects super_admin → `/mvs/admin`, student → `/app`, anon → `/auth/login?next=`. Defense-in-depth allowlist: anything that isn't `org_admin` redirects to login (subagent flagged the missing explicit check).
- `/org/layout.tsx`: header with org name + display name + sign-out.
- `/org/page.tsx`: server component, all data via SSR authenticated client so RLS scopes everything to `auth_org()`. Three sections:
  - **Org info card** — name, type, contact info.
  - **Snapshot** — students/enrollments/completed counts.
  - **Performance by assessment** — rows from `org_assessment_rollup` with enrolled/done/pass-rate/avg-score/avg-time.
  - **Roster** — students grouped, each row showing per-enrollment phase + score% + pass/fail badge for MC + completion timestamp.
- **NO** access to per-student `responses_long` rows. Aggregates and per-enrollment scores only — doctrine-locked.

### Subagent audit (clean — 3 medium items, 2 fixed pre-commit, 1 deferred)
1. ✅ **Defense-in-depth `requireOrgAdmin` allow-check** — added explicit `role !== 'org_admin'` redirect.
2. ✅ **Silent student→org_admin promotion** — surfaced as `promoted_student` status with explicit message asking the doctor to confirm intent.
3. ⚠️ **TOCTOU race in inviteOrgAdmin** — concurrent invites of the same user to different orgs could both pass the conflict check and the second upsert overwrites org_id. Deferred (low likelihood, single-admin model). Mitigation: switch to conditional update with `WHERE role <> 'super_admin' AND (org_id IS NULL OR org_id = $orgId)`.

Plus low-severity: `getOrg` in /org page uses service-role (bypasses RLS), but the org_id input comes from the org_admin's own profile (which they cannot self-mutate per 0003 RLS). Worth flagging if a future feature lets profiles.org_id be modified server-side.

### End-to-end (browser, real org_admin)
- Created `dannygreer+orgadmin@gmail.com` via admin SDK directly (Resend sandbox rejects plus-aliases for invite emails — known limitation, must verify domain before cohort).
- Promoted to org_admin in Day 3 Test Org via SQL.
- Signed in via `/dev/login-as?email=...` (re-added then deleted).
- `/org` rendered correctly: snapshot 1/4/4, performance table all 4 rows, roster with green 82% pass + red 40% fail badges.

**Day 7 plan (per `MVS_Project_Plan.md`):**
- Email automation via Resend SDK (transactional templates, separate from Supabase Auth's SMTP).
- Vercel Cron route for due-soon reminder ticks.
- Triggers: enrollment created (invite), 3 days before due (pre-reminder), training day +1 (post-invite), 3 days after post-invite (post-reminder).
- Track `invited_email_sent_at` and `reminder_sent_at` on `enrollments`.

**Open items / backlog:**
- **Resend domain verification** — unblocked Day 7 fully if done. Sandbox can't email any non-Danny address (including plus-aliases for the invite-org-admin path).
- **inviteOrgAdmin should not roll back when SMTP fails** — if Resend rejects the email, the user record creation is also reverted. Better UX: create the user first via `createUser`, then attempt `generateLink` + email send separately. Failed email becomes a soft warning, not a hard failure. Will surface this when domain is verified.
- **TOCTOU race fix** in inviteOrgAdmin (subagent #7).
- **Per-student detail expansion** in /org roster — currently shows all enrollments inline; could collapse and expand for orgs with many students. Day 10 polish.
- **Org admin can see student names but not emails** — by design (no auth.users access). Reconsider when org_admin workflows need email contact (e.g., for a "remind this student" button).
