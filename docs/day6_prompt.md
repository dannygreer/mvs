# Day 6 Prompt — paste this into Claude Code (cwd = repo root)

You're working on the Mental Velocity System (MVS) LMS. Days 1-5 shipped: Supabase Auth + RLS, super_admin cutover, orgs admin tooling, bulk-invite, student portal with enrollment-linked response capture, multi-choice runner with the real 50-question Test Bank. Today (Day 6) we build the **org admin portal** at `/org` and the supporting scoring view + invite-org-admin UI.

Read these in order before any code:
1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/MVS_Project_Plan.md` §3 (roles + tenancy locked decisions)
4. `worklog.md` — Days 1-5
5. `docs/needs_doctor.md` — note the doctor's rubric: 80% pass (40/50 correct), four-tier performance bands, "outcome trap" disqualifier
6. `docs/needs_human.md`

You are running with `--dangerously-skip-permissions`. Plan to work autonomously for **3 hours**.

## Branch
Branch from `main` as `feat/org-admin-portal`. Verify Day 5's work is on `main`; if not, log to `needs_human.md` and rebase as appropriate.

## Doctrine reminder
The org admin sees **aggregate** data only. Per-student response-event drilldowns belong to super_admin. Org admin never sees raw `responses_long` rows or another org's anything. RLS does the enforcement; app code never re-implements tenant isolation.

## Scope today

Four things, in this order:

1. Migration `0007_enrollment_scores_view.sql` — a SQL view that computes per-enrollment score (correct/total/percent/pass) plus timing aggregates, joining `enrollments` → `responses_long` → `mc_options`. Used by both super_admin and org_admin dashboards.
2. Invite-org-admin UI on the existing `/mvs/admin/orgs/[id]` page — single-row variant of Day 3's bulk invite, but creates an `org_admin` instead of a `student`.
3. `/org` portal — landing page that shows the org admin their own org's name, roster (with completion + score per student per enrollment), and aggregate metrics (invited, completed, pass-rate, avg score, avg total time).
4. RLS verification + subagent audit specifically for cross-org leakage.

### Phase A — Foundation check (~10 min)
1. `git checkout main && git pull`. `git checkout -b feat/org-admin-portal`.
2. `npm install` → `npm run build`.
3. As super_admin, hit `/mvs/admin/orgs` and confirm the orgs list + detail still render. Confirm the test student from Days 4-5 has both a scenario and a multi-choice enrollment, with at least one completed.
4. Confirm `auth_role()` and `auth_org()` helpers from migration 0003 still resolve correctly (`select auth_role(); select auth_org();` while authenticated as a known org_admin via SQL editor — or skip and trust Day 2's tests).

### Phase B — Migration 0007: enrollment_scores view (~30 min)

Create `supabase/migrations/0007_enrollment_scores_view.sql`:

```sql
-- 0007_enrollment_scores_view.sql
-- A read-only view exposing per-enrollment scoring + timing aggregates.
-- Used by super_admin dashboards and the org_admin portal.
-- Scenario enrollments: only timing fields populated; score fields are null.
-- Multi-choice enrollments: full score + pass per the doctor's 80% rubric.

create or replace view enrollment_scores as
with mc_correctness as (
  -- For each MC response, look up whether the selected option is correct.
  -- responses_long.option_selected = mc_options.label, joined via question_id.
  select
    rl.enrollment_id,
    rl.id as response_id,
    case
      when rl.option_selected is null then false
      when mo.is_correct = true       then true
      else                                   false
    end as is_correct
    from responses_long rl
    join enrollments e on e.id = rl.enrollment_id
    join assessments a on a.id = e.assessment_id and a.kind = 'multi_choice'
    join mc_questions q on q.assessment_id = a.id and q.sequence::text = rl.question_id  -- see note
    left join mc_options mo
      on mo.question_id = q.id and mo.label = rl.option_selected
)
select
  e.id                             as enrollment_id,
  e.student_id,
  p.org_id,
  e.assessment_id,
  a.code                           as assessment_code,
  a.kind                           as assessment_kind,
  e.phase,
  e.assigned_at,
  e.completed_at,
  -- Timing aggregates (apply to every kind)
  (select count(*)            from responses_long rl where rl.enrollment_id = e.id) as response_count,
  (select count(*) filter (where timed_out)
                              from responses_long rl where rl.enrollment_id = e.id) as timed_out_count,
  (select coalesce(sum(rt_ms), 0)
                              from responses_long rl where rl.enrollment_id = e.id) as total_time_ms,
  (select round(avg(rt_ms))   from responses_long rl where rl.enrollment_id = e.id) as avg_rt_ms,
  -- Score fields (multi_choice only)
  case when a.kind = 'multi_choice'
       then (select count(*) from mc_correctness c where c.enrollment_id = e.id and c.is_correct)
       else null end          as correct_count,
  case when a.kind = 'multi_choice'
       then (select count(*) from mc_questions q where q.assessment_id = a.id)
       else null end          as total_questions,
  case when a.kind = 'multi_choice'
       then round(
              (select count(*) from mc_correctness c where c.enrollment_id = e.id and c.is_correct)::numeric
              / nullif((select count(*) from mc_questions q where q.assessment_id = a.id), 0)
              * 100, 1)
       else null end          as score_percent,
  case when a.kind = 'multi_choice'
       then (
         (select count(*) from mc_correctness c where c.enrollment_id = e.id and c.is_correct)::numeric
         / nullif((select count(*) from mc_questions q where q.assessment_id = a.id), 0)
       ) >= 0.8
       else null end          as pass
from enrollments e
join profiles p on p.id = e.student_id
join assessments a on a.id = e.assessment_id;

-- Note on the join: we stored question_id on responses_long as the sequence number (text)
-- per Day 5's wiring. If you stored mc_questions.id (uuid) instead, change the join to:
--   join mc_questions q on q.id::text = rl.question_id
-- Pick whichever matches your actual Day 5 implementation. CHECK FIRST before writing the view.

-- Views inherit RLS from their underlying tables. We rely on:
--   - enrollments policies (super_admin all; org_admin reads enrollments where student_id in own org; student reads own)
--   - responses_long policies (super_admin all; org_admin reads where student in own org)
-- Double-check by querying the view as each role in tests/rls-day6.spec.ts.

-- Convenience: a per-org rollup the org_admin dashboard can hit in one query.
create or replace view org_assessment_rollup as
select
  p.org_id,
  es.assessment_id,
  es.assessment_code,
  es.assessment_kind,
  es.phase,
  count(*)                                                    as enrolled_count,
  count(*) filter (where es.completed_at is not null)         as completed_count,
  count(*) filter (where es.pass is true)                     as passed_count,
  round(avg(es.score_percent) filter (where es.pass is not null), 1) as avg_score_percent,
  round(avg(es.total_time_ms) filter (where es.completed_at is not null)) as avg_total_time_ms,
  round(avg(es.avg_rt_ms)     filter (where es.completed_at is not null)) as avg_rt_ms
from enrollment_scores es
join profiles p on p.id = es.student_id
group by p.org_id, es.assessment_id, es.assessment_code, es.assessment_kind, es.phase;
```

Apply via `npx supabase db push`.

**FIRST:** open `src/actions/quiz.ts` and confirm exactly what gets stored in `responses_long.question_id` for multi-choice submissions — sequence-as-text or UUID-as-text. Adjust the view join accordingly. The note in the SQL flags it; do not guess.

Add 4 vitest cases in `tests/rls-day6.spec.ts`:
- super_admin can `select * from enrollment_scores` across all orgs ✓
- org_admin can select rows where `org_id = own org` ✓
- org_admin CANNOT select rows for `org_id = other org` ✗
- score_percent computes correctly for a known MC enrollment with known correct/incorrect responses (insert test data via service role, then verify)

Run until green. Fix the view in place if wrong — don't stack a 0008.

### Phase C — Invite org_admin UI (~45 min)

Day 3 built bulk-invite for students on `/mvs/admin/orgs/[id]`. Add a parallel single-admin invite:

1. New section on the org detail page: "**Org admins**" — table showing current org_admins for this org (name, email, invited date), with an "Invite admin" form below (single email + name input — not bulk).

2. Server action `inviteOrgAdmin(orgId, fullName, email)` in `src/actions/orgs.ts`:
   - `requireSuperAdmin()` first.
   - Validate email format and not blank.
   - `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: '<APP_URL>/auth/callback?next=/org' })`.
   - Handle "User already registered" by fetching existing user and continuing.
   - **Critical:** `update profiles set org_id = <orgId>, role = 'org_admin', full_name = <fullName> where id = <user.id>`. If profile already has `role = 'super_admin'`, refuse — never demote a super_admin via this UI. If profile is in another org as student or org_admin, surface as conflict (don't overwrite).
   - Return `{ status: 'invited' | 'already_admin' | 'conflict', message }`.

3. The roster section from Day 3 already shows students. Make sure it filters to `role = 'student'` so org admins don't show up there twice.

### Phase D — `/org` portal (~75 min)

Plain Tailwind 4. Mirror the structure of `/app` from Day 4 but data-rich.

1. **Auth helper.** Add `getOrgAdmin()` and `requireOrgAdmin()` to `src/lib/auth.ts`. `requireOrgAdmin()` redirects non-org_admins:
   - super_admin → `/mvs/admin`
   - student → `/app`
   - anon → `/auth/login?next=/org`

2. **Layout.** `src/app/org/layout.tsx`. Header with org name (loaded from their profile's org), welcome name, sign-out button (reuse Day 2's `signOut` action).

3. **Index page.** `src/app/org/page.tsx`:
   - Server Component, `requireOrgAdmin()` at top.
   - **Org info card** — name, type, contact info (read-only).
   - **Aggregate metrics** — pull from `org_assessment_rollup` view, scoped to their `auth_org()`. Show one card per (assessment, phase) combination with: enrolled, completed, pass rate (MC only), avg score (MC only), avg total time.
   - **Roster table** — list students in their org. Columns: name, email (need service-role to read auth.users.email — be careful: org_admin must NOT have direct read access to auth.users; do this read in a server action that already gated by `requireOrgAdmin()`), # enrollments, # completed, latest score (MC). Sort by completion %.
   - **Per-student detail expansion** — click a row to see that student's enrollment list with phase, completed_at, score_percent, pass status. Read from `enrollment_scores` view.
   - **NO** view of individual `responses_long` rows. Org admin sees aggregates and per-enrollment scores only. The doctrine: per-decision data belongs to super_admin (the doctor's analysis tool).

4. **Empty states** — if their org has no students yet, "No students invited yet — your facilitator will invite your team and they'll appear here once they sign in."

### Phase E — RLS verification (~15 min)

Beyond the unit tests in Phase B, do a manual check:
1. Create a second test org via super_admin UI.
2. Bulk-invite a test student to it.
3. Make a test org_admin user for the FIRST org (using your new Phase C UI).
4. Sign in as the test org_admin → land on `/org`.
5. Confirm: only org #1 data visible. Roster shows only org #1 students. No way to see org #2 students or scores.
6. Open browser devtools → Network. Confirm no API call returns rows from the other org.
7. Try `view-source:` on the page. Confirm no other-org data leaked into the rendered HTML.

Log results in worklog.

### Phase F — Subagent audit (~20 min)

Launch a Task with this brief:

> Independently audit the org admin portal on branch `feat/org-admin-portal`. Specifically check:
> 1. Does `requireOrgAdmin()` correctly redirect super_admin → `/mvs/admin`, student → `/app`, anon → `/auth/login`? Cite file:line.
> 2. Can an org_admin in org A reach any data from org B via: (a) the rendered `/org` page, (b) the server actions called by `/org`, (c) direct queries against `enrollment_scores` or `org_assessment_rollup` views from the authenticated client?
> 3. Does the `enrollment_scores` view correctly compute `pass = true` only when score_percent >= 80? Spot-check the SQL math.
> 4. Does the per-student detail expansion show `responses_long` rows? It MUST NOT — only enrollment-level scores. Verify.
> 5. In `inviteOrgAdmin`: can a super_admin accidentally demote another super_admin via this flow? Can the conflict path silently overwrite an existing org_admin's `org_id`?
> 6. Does the `org_admin reads auth.users.email` path use a properly-gated server action with `requireOrgAdmin()` at the top, or does it leak into a client component?
> Report findings with file:line references.

Address findings before commit. Items 2 and 4 are real data-leak risks — fix immediately if flagged.

### Phase G — End-to-end test (~10 min)

1. Sign in as test org_admin → `/org`.
2. See their org name, the test student's name in the roster.
3. See aggregate metrics for whatever the test student has completed (active-threat scenario + MC stub from Day 5).
4. Click test student → see their enrollments with scores. MC enrollment shows score_percent and pass status. Scenario enrollment shows timing only.
5. Sign out → sign in as a different org_admin (or as a student) → confirm `/org` is inaccessible (redirected appropriately).

### Phase H — Stop cleanly (~15 min)

1. Append `worklog.md`: what shipped, RLS test results, subagent findings, end-to-end results, what's deferred.
2. `npm run build` — must pass.
3. Commit: `feat: org admin portal + scoring view + invite-org-admin UI`.
4. Push.
5. Print chat summary: what's working, subagent findings + how addressed, what Day 7 will do (Resend email automation: invite, pre-reminder, post-invite, post-reminder + Vercel Cron).

**Do NOT** start Day 7 today.

## Day 6 acceptance criteria
- `0007_enrollment_scores_view.sql` applied; `enrollment_scores` and `org_assessment_rollup` views queryable.
- ≥4 RLS tests for the new views green.
- `/org` renders for an org_admin with their org's roster + aggregate metrics; cross-org access blocked at every layer (route, query, view).
- `inviteOrgAdmin` server action works; super_admins cannot accidentally be demoted; conflicts surface, never silently overwrite.
- Subagent findings (especially #2, #4) addressed.
- `npm run build` passes; branch pushed.

## Things to watch
- **The `responses_long.question_id` join.** The view assumes a specific format. Verify before writing. Wrong format = silently zero `correct_count` for everyone.
- **Email reads from `auth.users`.** RLS doesn't apply to `auth.users` for org_admin — their authenticated client cannot select from there at all. Email must be loaded in a server action that's gated by `requireOrgAdmin()` and uses the service-role client. Do NOT pass auth.users rows through to the client.
- **Don't expose per-decision data.** Even though org_admin "could" see it via service-role queries we control, the doctrine says no. Aggregates and per-enrollment scores only. The doctor's analysis is the per-decision view, and it lives in super_admin.
- **The 80% rubric is locked.** Don't make it configurable in v1. Hardcode `>= 0.8` in the view. If the doctor changes his mind later, that's a one-line view migration.

Go.
