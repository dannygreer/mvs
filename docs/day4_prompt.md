# Day 4 Prompt — paste this into Claude Code (cwd = repo root)

You're working on the Mental Velocity System (MVS) LMS. Days 1-3 shipped: Supabase Auth + RLS + super_admin cutover, orgs admin tooling, bulk-invite. Today (Day 4) we build the **student-facing side**: link the existing event-based response tables to enrollments, build the student portal at `/app`, and wire the existing Quiz runner to take an assessment in the context of an enrollment.

Read these in order before any code:
1. `AGENTS.md` (Next.js 16 quirks)
2. `CLAUDE.md` (working agreement, doctrine, autonomous-mode rules)
3. `docs/MVS_Project_Plan.md` §1 (what's already built — the Quiz runner is doctrine-correct, **reuse it, don't rebuild**) and §2 (what's left)
4. `worklog.md` — Days 1-3 entries; you'll be using helpers from prior days (`requireSuperAdmin()`, the new `assessments` + `enrollments` tables, etc.)
5. `docs/needs_human.md`

You are running with `--dangerously-skip-permissions`. Plan to work autonomously for **3 hours**. Follow autonomous-mode rules: don't stop to confirm, log blockers to `docs/needs_human.md`, append to `worklog.md`, commit at every working chunk, push at the end.

## Branch
Branch from `main` as `feat/student-portal`. If Day 3's branch (`feat/orgs-and-invite`) hasn't merged yet, log to `needs_human.md` and either rebase against `main` actual head or branch from `feat/orgs-and-invite`. Don't waste a session waiting.

## Doctrine reminder — the Quiz runner is sacred
`src/components/quiz/Quiz.tsx` and `ScenarioScreen.tsx` are the canonical event-based, client-side-RT, branching, no-back-button pattern. **Do not rewrite them.** Today's job is to *invoke* them from a new student route with new identity context (enrollment + student instead of anonymous first/last name). Add optional props or a thin wrapper — don't refactor the runner internals.

## Scope today

Three things, in this order:

1. Migration `0005_link_responses_to_enrollments.sql` — adds `enrollment_id` and `student_id` columns to `responses_long` + `responses_wide`, plus RLS policies for student-self-access and org-admin-read.
2. Student portal at `/app` — list of assigned enrollments, "Start" button, "Take" page that mounts the existing Quiz runner with enrollment context.
3. Wire `submitAssessment` to populate the new columns and stamp `enrollments.completed_at`.

### Phase A — Foundation check (~10 min)
1. `git checkout main && git pull`. Confirm `0004_assessments_and_enrollments.sql` is present in `supabase/migrations/`. If not, see branch note above.
2. `git checkout -b feat/student-portal`.
3. `npm install` → `npm run build`.
4. As super_admin, hit `/mvs/admin/orgs`, create a test org if needed, invite **one** test student email you control. Confirm the magic-link invite works end-to-end and `profiles.org_id` populates.
5. Manually create one `enrollments` row for that test student against the active-threat assessment, phase=`pre`:
   ```sql
   insert into enrollments (student_id, assessment_id, phase)
   select p.id, a.id, 'pre'
     from profiles p, assessments a
    where p.full_name ilike '%<your test name>%'
      and a.code = 'active_threat_v1';
   ```
   You need this for end-to-end testing later. Log the row's id in `worklog.md`.

### Phase B — Migration 0005 (~30 min)

Create `supabase/migrations/0005_link_responses_to_enrollments.sql`:

```sql
-- 0005_link_responses_to_enrollments.sql
-- Link the doctrine-locked response tables to enrollments + students.
-- Columns are nullable so existing legacy/anonymous rows are preserved untouched.

alter table responses_long
  add column enrollment_id uuid references enrollments(id) on delete set null,
  add column student_id    uuid references profiles(id)    on delete set null;
create index responses_long_enrollment_idx on responses_long(enrollment_id);
create index responses_long_student_idx    on responses_long(student_id);

alter table responses_wide
  add column enrollment_id uuid references enrollments(id) on delete set null,
  add column student_id    uuid references profiles(id)    on delete set null;
create index responses_wide_enrollment_idx on responses_wide(enrollment_id);
create index responses_wide_student_idx    on responses_wide(student_id);

-- RLS additions. The 0003 super_admin policies stay; we layer student + org_admin access.

-- Student: insert + select their own rows. The check on student_id = auth.uid()
-- is the critical bit — server action validates separately, but this is the DB-level guard.
create policy "student insert own responses_long" on responses_long for insert
  with check (auth_role() = 'student' and student_id = auth.uid());
create policy "student select own responses_long" on responses_long for select
  using (auth_role() = 'student' and student_id = auth.uid());

create policy "student insert own responses_wide" on responses_wide for insert
  with check (auth_role() = 'student' and student_id = auth.uid());
create policy "student select own responses_wide" on responses_wide for select
  using (auth_role() = 'student' and student_id = auth.uid());

-- Org admin: read responses for students in their org.
create policy "org_admin read responses_long in org" on responses_long for select
  using (auth_role() = 'org_admin'
         and student_id in (select id from profiles where org_id = auth_org()));
create policy "org_admin read responses_wide in org" on responses_wide for select
  using (auth_role() = 'org_admin'
         and student_id in (select id from profiles where org_id = auth_org()));
```

Apply via `npx supabase db push` (or SQL editor + log if CLI auth balks).

Add 4 vitest cases in `tests/rls.spec.ts` (or a new `tests/rls-day4.spec.ts`):
- student can insert a `responses_long` row with `student_id = self` ✓
- student CANNOT insert with `student_id = other_student_id` ✗
- student can select own responses, cannot select other student's ✗
- org_admin can select responses for own org's students, cannot for another org's ✗

Run until green. If a policy is wrong, fix `0005_*.sql` in place — don't stack a fix migration.

### Phase C — `/app` student portal (~75 min)

Create the route group and pages. Plain Tailwind 4, no UI library.

1. **Auth helper.** Add `getStudent()` and `requireStudent()` to `src/lib/auth.ts` mirroring the super_admin helpers. `requireStudent()` should redirect non-students to `/auth/login?next=/app` (or to `/mvs/admin` if they're super_admin, `/org` if org_admin — whichever the existing proxy logic does).

2. **Layout.** `src/app/app/layout.tsx` (or use a `(student)` route group if tidier). Header with welcome name + sign-out button (`signOut` action exists from Day 2 in `src/actions/session.ts`). No fancy nav — there's only one page.

3. **Index.** `src/app/app/page.tsx`:
   - Server Component, `requireStudent()` at top.
   - Query `enrollments` joined to `assessments` (for name/kind) for the current `auth.uid()`. RLS policy "student read own enrollments" from Day 3 handles this when using the authenticated client.
   - Two sections: **Assigned (incomplete)** with "Start" buttons, and **Completed** with a date and a tasteful "Done" badge.
   - "Start" button on an enrollment links to `/app/take/[enrollmentId]`.
   - If there are no enrollments at all, show a friendly empty state ("Nothing assigned yet — your facilitator will send you something soon").
   - **No back buttons. No progress signals.** This is doctrine territory.

4. **Take.** `src/app/app/take/[enrollmentId]/page.tsx`:
   - Server Component, `requireStudent()`.
   - Load the enrollment via authenticated client (RLS will reject if not theirs). If completed, redirect to `/app` with a flash that says "You've already completed that one."
   - Load the linked assessment + scenario.
   - For `kind = 'scenario'`: pass `scenario`, `enrollmentId`, `studentId`, `phase`, and the student's `full_name` (split into first/last) as props to a Client Component wrapper around the existing Quiz runner.
   - For `kind = 'multi_choice'`: that's Day 5. For now, render a `[NEEDS_DAY_5]` placeholder. Don't crash.

### Phase D — Wire enrollment to the Quiz runner (~45 min)

Two clean approaches; pick whichever requires the smaller diff to `Quiz.tsx`:

**Option 1 (preferred) — add optional props to existing Quiz.tsx:**
- Accept optional `enrollmentId?: string`, `studentId?: string`, `prefillFirstName?: string`, `prefillLastName?: string`, `prefillPhase?: 'pre' | 'post' | 'practice'`.
- If `enrollmentId` is provided, skip the `'title'` step, auto-set fn/ln/phase from the prefills, and start at `'reading'`.
- Pass `enrollmentId` and `studentId` through to `submitAssessment()`.

**Option 2 — thin wrapper:**
- New component `src/components/quiz/EnrolledQuiz.tsx` that wraps Quiz and skips the title step.
- Slightly cleaner separation, slightly more code.

Either way: **do not change the reaction-time capture in `ScenarioScreen.tsx`.** That's the doctrine-locked code.

Then update `src/actions/quiz.ts`:
- `submitAssessment` already exists. Add optional `enrollmentId` + `studentId` to its input.
- When `enrollmentId` is provided:
  1. Load the enrollment using the **service-role client** (server action; we want to validate, not enforce via RLS).
  2. **Validate ownership**: `enrollment.student_id === studentId === passed-in student_id`. If not, throw — log to console with no PII.
  3. **Validate not already completed**: `enrollment.completed_at is null`. If already completed, throw "already completed" and instruct the client to redirect.
  4. Insert the `responses_long` rows with `enrollment_id` + `student_id` populated. Insert the `responses_wide` row the same way.
  5. `update enrollments set completed_at = now() where id = enrollmentId`.
  6. Wrap in a transaction if practical (Postgres function or careful sequencing — the existing pattern uses sequential supabase-js calls, fine for v1).
- When `enrollmentId` is NOT provided (legacy anonymous path at `/`), behave exactly as today — no breakage.

### Phase E — Subagent review (~25 min)

Launch a Task with this brief:

> Independently review the student portal + enrollment-linked submission on branch `feat/student-portal`. Specifically check:
> 1. Can a student submit `responses_long` rows under another student's `enrollment_id` or `student_id`? Trace `submitAssessment()` validation end-to-end.
> 2. Can a student replay an already-completed enrollment (overwriting prior data)?
> 3. Does the RLS "student insert" policy on `responses_long` hold even if a malicious authenticated client supplies a different `student_id` directly via supabase-js (i.e., bypassing the server action)?
> 4. Does `/app/take/[enrollmentId]` reject (a) non-students, (b) the wrong student, (c) an enrollment that doesn't exist?
> 5. Does the `<EnrolledQuiz>` / extended `Quiz` keep the doctrine-locked client-side reaction time intact (paint→click via `useRef(Date.now())` in `AnswerScreen`)? Read `ScenarioScreen.tsx` to confirm no regression.
> 6. Are there any back buttons, progress bars, or "Step N of M" indicators visible to the student in the new portal that violate the doctrine?
> Report findings with file:line references.

Address whatever it flags. Critically, items 1-3 are real-data integrity issues — fix before commit.

### Phase F — End-to-end test (~15 min)

With your test student account:
1. Sign in via magic link → land on `/app`.
2. See the assigned active-threat enrollment with a "Start" button.
3. Click Start → land on the Read screen → continue → take the full assessment through the convergence + final pressure screens.
4. Submit. Verify in Supabase SQL editor:
   - `select count(*) from responses_long where enrollment_id = '<id>'` returns the expected count (one row per decision step).
   - `select student_id from responses_long where enrollment_id = '<id>' limit 1` returns your auth.uid().
   - `select reaction_time_ms from responses_long where enrollment_id = '<id>'` — values look plausible (>200ms, <30000ms).
   - `select completed_at from enrollments where id = '<id>'` is non-null.
5. Click back to `/app` → enrollment now appears under "Completed."
6. Try to revisit `/app/take/<id>` → should redirect with "already completed" message.

Log each check pass/fail in worklog.

### Phase G — Stop cleanly (~15 min)

1. Append `worklog.md`: what shipped, RLS test results, subagent findings, end-to-end test results, what's deferred to Day 5.
2. Update `docs/needs_human.md` if anything new is blocking.
3. `npm run build` — must pass.
4. Commit: `feat: student portal + enrollment-linked response capture`.
5. Push.
6. Print chat summary: what's working, subagent findings + how addressed, what Day 5 will do (multi-choice runner for the 50-question Test Bank).

**Do NOT** start Day 5 today.

## Day 4 acceptance criteria
- `0005_link_responses_to_enrollments.sql` applied; new columns present and indexed.
- RLS tests for student/org_admin response access green (≥4 new cases).
- `/app` lists the test student's enrollments correctly; sign-out works.
- `/app/take/[enrollmentId]` mounts the existing Quiz runner with prefilled identity, no title screen, no doctrine regressions.
- Submitting completes the enrollment, populates `enrollment_id` + `student_id` on every `responses_long` row, and stamps `completed_at`.
- Subagent findings (especially #1-3) recorded and addressed in `worklog.md`.
- The legacy anonymous flow at `/` still works untouched.
- `npm run build` passes; branch pushed.

## Things to watch
- **Service role vs. authenticated client.** The existing `src/lib/db.ts` uses service role and bypasses RLS. The student portal can keep doing this for writes (server actions validate ownership) but should use the authenticated client for the `enrollments` listing query so RLS does the tenant guard. Your call which to use; document it.
- **Don't change `ScenarioScreen.tsx`.** Doctrine-locked. If the runner needs new info, pass it as a prop, don't restructure the AnswerScreen.
- **The `participant_id` legacy string field** (`first_last_timestamp`) on `responses_long` — keep populating it for backward compat with existing admin views. Add `student_id` alongside; don't remove `participant_id` until Day 9-10.
- **Doctrine concern open in `needs_doctor.md` #9** ("Step N" indicator). Don't address today — that's the doctor's call. Just confirm no NEW progress indicators got added.

Go.
