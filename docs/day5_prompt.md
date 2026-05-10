# Day 5 Prompt — paste this into Claude Code (cwd = repo root)

You're working on the Mental Velocity System (MVS) LMS. Days 1-4 shipped: Supabase Auth + RLS + super_admin cutover, orgs admin tooling, bulk-invite, student portal, enrollment-linked response capture for scenario-style assessments. Today (Day 5) we add the **second assessment type**: the 50-question multi-choice Test Bank from Dr. Scully's `Test_Bank_Doctrine_Locked.docx`.

Read these in order before any code:
1. `AGENTS.md`
2. `CLAUDE.md` (doctrine, autonomous-mode rules)
3. `docs/MVS_Project_Plan.md` §2.1 (the `mc_questions` / `mc_options` schema; today they become migration 0006, not 0004 — the original numbering is stale)
4. `worklog.md` — Days 1-4. You'll be reusing the `AnswerScreen` reaction-time pattern from `src/components/quiz/ScenarioScreen.tsx`.
5. `docs/needs_doctor.md` — item #1 (Test Bank answer key) was RESOLVED 2026-05-08 — the doctor delivered cleaned questions + answer key. Real seed lives at `supabase/seeds/mc_test_bank_v1.sql`. Item #3 (response_category taxonomy for MC) is still unresolved; seed leaves `response_category` NULL.

You are running with `--dangerously-skip-permissions`. Plan to work autonomously for **3 hours**.

## Branch
Branch from `main` as `feat/multi-choice-runner`. Verify Day 4's `0005_link_responses_to_enrollments.sql` is present in `supabase/migrations/`. If Day 4's branch hasn't merged, log to `needs_human.md` and either rebase or branch from `feat/student-portal`.

## Doctrine reminder — DO NOT touch `ScenarioScreen.tsx`
The `AnswerScreen` reaction-time capture (`startTimeRef = useRef(Date.now())` set on mount, elapsed measured at click) is the canonical doctrine-locked pattern. Read it before writing the multi-choice runner. Mirror the pattern exactly. The MC runner is a **sibling component** that uses the same RT mechanism — not a refactor of the scenario runner.

## Scope today

Four things, in this order:

1. Migration `0006_multi_choice_test.sql` — creates `mc_questions` + `mc_options` tables, RLS, and seeds the assessment row only. Real 50-question content + answer key lands via `supabase/seeds/mc_test_bank_v1.sql` (already authored, see Phase B).
2. `McRunner` component — single-question-per-screen, client-side RT, no back button, auto-advance.
3. Wire `/app/take/[enrollmentId]` to launch `McRunner` when `assessment.kind = 'multi_choice'` (today it bails with the Day 4 placeholder).
4. Verify admin tabs (Summary, Responses, ScenarioBuilder, ResponseTagging, CSV export) don't break when MC rows show up in `responses_long`.

### Phase A — Foundation check (~10 min)
1. `git checkout main && git pull`. `git checkout -b feat/multi-choice-runner`.
2. `npm install` → `npm run build`.
3. As super_admin, hit `/mvs/admin` and confirm the existing tabs render without error.
4. As your test student from Day 4, confirm `/app` still works and shows the (now-completed) active-threat enrollment.

### Phase B — Migration 0006 + real seed (~45 min)

Create `supabase/migrations/0006_multi_choice_test.sql` — schema + RLS + assessment row only:

```sql
-- 0006_multi_choice_test.sql
-- Adds the multi-choice assessment type for the 50-question Test Bank.
-- The schema lands here. The real 50-question content + answer key is in
-- supabase/seeds/mc_test_bank_v1.sql, applied separately after this migration.

create table mc_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  sequence int not null,
  prompt text not null,
  time_limit_seconds int,
  unique(assessment_id, sequence)
);
create index mc_questions_assessment_idx on mc_questions(assessment_id, sequence);

create table mc_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references mc_questions(id) on delete cascade,
  label text not null check (label in ('A','B','C','D')),
  text text not null,
  is_correct bool,                             -- populated by seed file
  response_category text,                      -- still NEEDS_DOCTOR for MC (see docs/needs_doctor.md #3)
  unique(question_id, label)
);
create index mc_options_question_idx on mc_options(question_id);

-- RLS
alter table mc_questions enable row level security;
alter table mc_options   enable row level security;

create policy "super_admin all on mc_questions" on mc_questions for all using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');
create policy "super_admin all on mc_options"   on mc_options   for all using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');

-- Authenticated users can read questions/options for active assessments only.
-- NOTE: do NOT expose is_correct to non-super_admins. The student client should
-- never see which option is correct. Wrap reads through a server action or a
-- view that strips is_correct + response_category for non-super_admin callers.
create policy "authenticated read mc_questions" on mc_questions for select using (
  auth.uid() is not null
  and assessment_id in (select id from assessments where is_active)
);
create policy "authenticated read mc_options" on mc_options for select using (
  auth.uid() is not null
  and question_id in (
    select id from mc_questions
     where assessment_id in (select id from assessments where is_active)
  )
);

-- Seed the parent assessment row. Real questions land via the separate seed file.
insert into assessments (code, name, kind, scenario_fk, is_active)
values ('mvs_test_bank_v1', 'MVS Certification Exam (50 Questions)', 'multi_choice', null, true)
on conflict (code) do nothing;
```

**Then apply the real seed:** `psql $DATABASE_URL -f supabase/seeds/mc_test_bank_v1.sql` (or paste into Supabase SQL editor). The seed:
- is idempotent (clears any prior questions/options for this assessment, then re-inserts)
- inserts all 50 questions with `time_limit_seconds = 30`
- inserts 200 options with `is_correct` set per the doctor's answer key
- includes a sanity check that fails the transaction if any question doesn't have exactly 4 options with exactly 1 correct
- leaves `response_category` NULL (the rubric doesn't categorize per-option; logged in `needs_doctor.md` #3)

Apply both: `npx supabase db push` for the migration, then run the seed. Confirm with `select count(*) from mc_questions where assessment_id = (select id from assessments where code = 'mvs_test_bank_v1')` returns 50, and `select count(*) from mc_options where is_correct = true and question_id in (select id from mc_questions where assessment_id = ...)` returns 50.

**CRITICAL — protect the answer key from leaking to students.** The current `authenticated read mc_options` policy lets a student select all columns including `is_correct`. Pick one of these fixes today:

**Option (a) — strip in the loader (simplest):** wherever you load options for the student runner, only select `id, label, text` — never `is_correct` or `response_category`. Document this as the canonical pattern in `src/lib/db.ts`.

**Option (b) — separate view (defense-in-depth):** create `mc_options_for_student` view that omits `is_correct` and `response_category`, grant select to authenticated, revoke select on the underlying table for authenticated.

Recommend (a) for v1 speed, but if Phase F subagent flags it as a real risk, do (b).

Add 4 vitest cases in `tests/rls.spec.ts` (or a new `tests/rls-day5.spec.ts`):
- super_admin can insert/select mc_questions ✓
- student can read mc_questions for active assessment ✓
- student CANNOT read mc_questions for inactive assessment ✗
- anon (no JWT) CANNOT read mc_questions ✗

Plus one explicit answer-key-leak test:
- student CANNOT see `is_correct=true` answers via the loader path used by `/app/take/[enrollmentId]` (test the actual loader, not the policy)

Run until green. If a policy is wrong, fix `0006_*.sql` in place. If the seed is wrong, fix `supabase/seeds/mc_test_bank_v1.sql` in place — it's idempotent so re-running is safe.

### Phase C — `McRunner` component (~75 min)

Create `src/components/quiz/McRunner.tsx`. Mirror the doctrine pattern from `ScenarioScreen.tsx`'s `AnswerScreen`. Specifically:

- Single question on screen at a time. No prompt-then-answer split (multi-choice questions are short — show the prompt and options together).
- `startTimeRef = useRef(Date.now())` set on mount via `useRef`. `elapsed = Date.now() - startTimeRef.current` on click.
- Optional countdown timer reusing `CountdownTimer` from `src/components/quiz/`.
- `answeredRef` to debounce double-clicks (same guard as `AnswerScreen`).
- On select OR timeout, call an `onResponse(label | null, rtMs, timedOut)` prop.
- Auto-advance to next question after a response (no Next button, no Back button).
- Progress: nothing. The doctrine forbids "Step 5 of 50" indicators. Do not add one. (Open question in `needs_doctor.md` #9 about the existing scenario "Step N" — for MC, default to none.)

Companion shell: `src/components/quiz/McQuiz.tsx` — analog of `Quiz.tsx` for the multi-choice flow:

- Props: `questions: McQuestion[]`, `enrollmentId: string`, `studentId: string`, `phase: 'pre'|'post'|'practice'`, `assessmentCode: string`.
- State machine: `'in_progress' | 'submitting' | 'results'`. No title screen — student already authenticated and identified.
- Iterate through questions in `sequence` order, hand each to `McRunner`.
- Maintain `responses: McResponse[]`.
- On final question response, call a new server action `submitMcAssessment({ enrollmentId, studentId, assessmentCode, responses })` (see Phase D).
- Show a simple results screen: "Submitted. <Sign out> | <Back to assignments>" — no scoring (we may not even have answers yet, and even when we do, scoring is the doctor's analysis to do).

Add types to `src/types/index.ts`:
```ts
export interface McQuestion {
  id: string;
  sequence: number;
  prompt: string;
  timeLimitSeconds: number | null;
  options: { id: string; label: 'A'|'B'|'C'|'D'; text: string }[];
}
export interface McResponse {
  questionId: string;     // mc_question.id
  sequence: number;
  optionLabel: 'A'|'B'|'C'|'D' | null;
  optionId: string | null;
  rtMs: number;
  timedOut: boolean;
}
```

### Phase D — Wire `/app/take/[enrollmentId]` + new server action (~45 min)

1. Update `src/app/app/take/[enrollmentId]/page.tsx`:
   - When `assessment.kind === 'scenario'`: existing Day-4 path, no change.
   - When `assessment.kind === 'multi_choice'`: load `mc_questions` + nested `mc_options` (ordered by sequence then label), pass to `<McQuiz>`.
   - On any other kind: log + render a "Unsupported assessment" message (defensive — there shouldn't be any).

2. New server action `submitMcAssessment` in `src/actions/quiz.ts`:
   - `requireStudent()` (Day 4 helper).
   - Load enrollment via service-role client. Validate ownership (`enrollment.student_id === auth.uid()`) and not-already-completed.
   - For each response, insert one `responses_long` row:
     - `participant_id`: keep populating with the legacy synthesized string for back-compat (e.g., `<student.full_name>_<unix_ts>`).
     - `student_id`: `auth.uid()`.
     - `enrollment_id`: enrollment id.
     - `phase`: enrollment.phase.
     - `scenario_id`: assessment.code (`'mvs_test_bank_v1'`) — the column is text and overloaded for both runners.
     - `scenario_version`: `'1'`.
     - `question_id`: the mc_question's UUID stringified, OR `'q01'..'q50'` based on sequence — whatever the existing admin views expect. Pick the one that doesn't break `ResponsesTab`.
     - `branch_path`: `''` (multi-choice doesn't branch).
     - `option_selected`: label (`'A'..'D'` or null on timeout).
     - `response_category`: `null` until doctor delivers (do NOT default to a scenario taxonomy value).
     - `rt_ms`: client-reported, milliseconds.
     - `timed_out`: bool.
   - Insert one `responses_wide` row mapping the first 50 answers to `q1_answer..q50_answer` and `q1_rt..q50_rt`. The existing schema only has `q1..q6`; the test bank has 50. **Schema gap.** Two options:
     - (a) Add columns `q7_answer..q50_answer` and `q7_rt..q50_rt` to `responses_wide` in `0006_*.sql`. Lots of columns, ugly, but matches existing pattern.
     - (b) Skip the `responses_wide` row for multi-choice; only `responses_long` is doctrinally required. Mark a TODO for the admin views to query `responses_long` for MC instead of `responses_wide`.
     - **Recommended: option (b).** Don't widen a wide table to 50 columns. Update the admin views to source MC summaries from `responses_long`.
   - `update enrollments set completed_at = now() where id = enrollmentId`.
   - Wrap in best-effort transactional sequencing (existing pattern).

3. CSV export at `src/app/api/admin/export-csv/route.ts`:
   - The long-format export already pulls from `responses_long` — should Just Work for MC rows. Verify.
   - The wide-format export pulls from `responses_wide` — MC rows won't appear there per option (b). Document the gap; admin still gets every MC row in the long export.

### Phase E — Admin doesn't break (~15 min)

Quick smoke through every admin tab as super_admin after the migration is applied and a stub MC submission has landed:
- Summary tab: doesn't crash on MC rows.
- Responses tab: shows MC rows alongside scenario rows, doesn't truncate or mis-render.
- ScenarioBuilder: still works for scenarios; MC assessment shows up as an entry but isn't editable through the scenario builder (that's fine — content authoring for MC is doctor's job, not admin UI in v1).
- ResponseTagging: tag taxonomy is currently scoped to scenarios. Doesn't need to support MC in v1; just confirm no crash. Log `needs_doctor.md` if MC needs its own tagging UI.
- CSV export: long format includes new MC rows.

### Phase F — Subagent review (~20 min)

Launch a Task with this brief:

> Independently review the multi-choice runner on branch `feat/multi-choice-runner`. Specifically check:
> 1. Does `McRunner` capture reaction time using the same client-side `useRef(Date.now())` pattern as `ScenarioScreen.tsx`'s `AnswerScreen`, with no server-derived RT slipping in? Cite line numbers.
> 2. Does `McRunner` have any back button, "Step N of M" indicator, progress bar, or other guidance signal that violates the doctrine?
> 3. Does `submitMcAssessment` validate (a) student owns the enrollment, (b) enrollment is not already completed, (c) supplied `student_id` matches `auth.uid()` (defending against client-side tampering)?
> 4. Could a student replay a completed MC enrollment and get a second submission accepted?
> 5. Are existing admin tabs (Summary, Responses, ScenarioBuilder, ResponseTagging, CSV export) intact for scenario-only data after the schema change?
> 6. Does the auto-advance behavior in `McQuiz` correctly debounce double-click / fast-keyboard taps so we don't write duplicate `responses_long` rows for the same question?
> Report findings with file:line references.

Address everything before commit.

### Phase G — End-to-end test (~10 min)

With your test student, manually create a second enrollment for the MC assessment:
```sql
insert into enrollments (student_id, assessment_id, phase)
select p.id, a.id, 'pre'
  from profiles p, assessments a
 where p.id = '<your-test-student-uid>'
   and a.code = 'mvs_test_bank_v1';
```

Then:
1. Sign in as the test student → `/app` shows the new MC enrollment.
2. Click Start → 5 stub questions render one at a time. No back button. No progress bar.
3. Select an option for each → auto-advance. Time the third one out by waiting → confirm timed_out captured.
4. Verify in SQL: 5 `responses_long` rows for the enrollment, all with `enrollment_id` populated, all with non-zero `rt_ms`, the timed-out row has `option_selected IS NULL` and `timed_out = true`.
5. Confirm `enrollments.completed_at` is set.
6. Try `/app/take/<that enrollment>` again → "already completed" redirect (Day 4 behavior).

### Phase H — Stop cleanly (~15 min)

1. Append `worklog.md`: what shipped, RLS test results, subagent findings, end-to-end results, what's deferred.
2. Update `docs/needs_doctor.md` with a sharper ask: deliver the 50-question Test Bank as a clean CSV (`sequence, prompt, A_text, B_text, C_text, D_text, correct_label, response_category_A..D`). The schema is ready; we need the content.
3. `npm run build` — must pass.
4. Commit: `feat: multi-choice runner + Test Bank schema + stub seed`.
5. Push.
6. Print chat summary: what's working, gaps still blocking on the doctor, what Day 6 will do (org admin portal `/org`).

**Do NOT** start Day 6 today.

## Day 5 acceptance criteria
- `0006_multi_choice_test.sql` applied; assessment row created.
- `supabase/seeds/mc_test_bank_v1.sql` applied; 50 questions + 200 options present; integrity check passes.
- RLS tests for new tables green (≥5 cases including the answer-key-leak test).
- `McRunner` + `McQuiz` reuse the doctrine-locked RT pattern verbatim from `AnswerScreen`. Subagent confirms.
- `/app/take/[enrollmentId]` renders the MC flow correctly when `kind='multi_choice'`; scenario flow still works for `kind='scenario'`.
- Test student takes the 5-stub MC assessment end-to-end; one `responses_long` row per question with valid RT; `enrollments.completed_at` populated.
- Admin tabs (Summary, Responses, ScenarioBuilder, ResponseTagging, CSV export) all still render without error and the long-format CSV export includes MC rows.
- Subagent findings recorded in `worklog.md`.
- `npm run build` passes; branch pushed.

## Things to watch
- **The wide-format gap.** `responses_wide` only has `q1..q6`. MC has up to 50. Per Phase D recommendation, do NOT widen the table — skip `responses_wide` writes for MC and rely on `responses_long`. Document this clearly in code + worklog so Day 9-10 admin polish doesn't get blindsided.
- **Real Test Bank content is now seeded.** The doctor delivered cleaned questions + answer key on 2026-05-08. Seed file at `supabase/seeds/mc_test_bank_v1.sql`. Read its header comments — there are still residual artifacts (Q29 reads "The interact becomes reactive, system responsive" verbatim) and the answer distribution is heavily B-skewed (41/50 = B). Both flagged in `docs/needs_doctor.md` for cohort-prep cleanup, not your problem today.
- **Answer key must NOT leak to the student client.** This is the single most important thing in Phase B. The student loader must select only `id, label, text` from `mc_options` — never `is_correct` or `response_category`. Subagent will check.
- **Defensive double-click.** `answeredRef.current` guard from `AnswerScreen` is the pattern. MC questions are short — the temptation to triple-click is real. Make sure the second click is a no-op, not a duplicate insert.
- **Don't change `Quiz.tsx` or `ScenarioScreen.tsx`.** Same doctrine warning as Day 4. MC is parallel architecture, not a refactor.

Go.
