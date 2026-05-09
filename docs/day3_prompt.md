# Day 3 Prompt — paste this into Claude Code (cwd = repo root)

You're working on the Mental Velocity System (MVS) LMS. Day 1 + Day 2 shipped: Supabase Auth, RLS policies, legacy admin auth removed, `/mvs/admin` is now gated by `requireSuperAdmin()`. Today (Day 3) we build the **multi-tenant admin tooling**: orgs list/detail/CRM-lite + bulk-invite students by email.

Read these in order before any code:
1. `AGENTS.md` (Next.js 16 quirks — `src/proxy.ts`, not `middleware.ts`)
2. `CLAUDE.md` (working agreement, doctrine, autonomous-mode rules)
3. `docs/MVS_Project_Plan.md` (specifically §2 — what's still to build)
4. `worklog.md` — read the Day 1 and Day 2 entries; you'll be using helpers shipped in Day 2 (`requireSuperAdmin()` from `src/lib/auth.ts`)
5. `docs/needs_human.md`

You are running with `--dangerously-skip-permissions`. Plan to work autonomously for **3 hours**. Follow autonomous-mode rules: don't stop to confirm, log blockers to `docs/needs_human.md`, append to `worklog.md`, commit at every working chunk, push at the end.

## Branch
Branch from `main` as `feat/orgs-and-invite`. Day 1 + Day 2's `feat/rls-and-admin-cutover` should already be merged — if `git log main` doesn't show those commits, log to `needs_human.md` and either rebase against `main`'s actual head or branch from `feat/rls-and-admin-cutover` instead.

## Scope today

Three things, in this order:

1. Migration `0004_assessments_and_enrollments.sql` — adds the `assessments` and `enrollments` tables, RLS, and backfills the existing active-threat scenario as the first `assessment` row.
2. Orgs admin UI — list, create, detail, edit, CRM-lite fields. Roster (read-only) on the detail page.
3. Bulk-invite students — paste-list UI on the org detail page that creates `auth.users` via Supabase Auth Admin API, populates `profiles.org_id` + `role='student'`, and sends magic-link invites.

### Phase A — Foundation check (~10 min)
1. `git checkout main && git pull`. Confirm `src/lib/auth.ts` exists with `requireSuperAdmin()` (Day 2 deliverable). If not, see branch note above.
2. `git checkout -b feat/orgs-and-invite`.
3. `npm install` → `npm run build`. Both must pass.
4. Confirm `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` (needed for `auth.admin.inviteUserByEmail()`).
5. Quick login smoke: `npm run dev`, hit `/mvs/admin` in a browser, confirm you (super_admin) still land on the dashboard.

### Phase B — Migration 0004 (~45 min)

Create `supabase/migrations/0004_assessments_and_enrollments.sql`:

```sql
-- 0004_assessments_and_enrollments.sql
-- Adds the assessments parent table (covering scenario-style + multi-choice
-- under one umbrella) and enrollments (assigning a student to phase × assessment).

create table assessments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                         -- 'active_threat_v1', 'mvs_test_bank_v1'
  name text not null,
  kind text not null check (kind in ('scenario','multi_choice')),
  scenario_fk uuid references scenarios(id) on delete restrict,  -- null when kind='multi_choice'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint scenario_required_when_scenario_kind
    check ((kind = 'scenario' and scenario_fk is not null)
        or (kind = 'multi_choice' and scenario_fk is null))
);
create index assessments_kind_idx on assessments(kind) where is_active;

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete restrict,
  phase text not null check (phase in ('pre','post','practice')),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  invited_email_sent_at timestamptz,
  reminder_sent_at timestamptz,
  completed_at timestamptz,
  unique(student_id, assessment_id, phase)
);
create index enrollments_student_idx on enrollments(student_id);
create index enrollments_assessment_idx on enrollments(assessment_id);
create index enrollments_due_idx on enrollments(due_at) where completed_at is null;

-- RLS
alter table assessments enable row level security;
alter table enrollments enable row level security;

-- assessments: super_admin manages; everyone authenticated can read active.
create policy "super_admin all on assessments"  on assessments for all using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');
create policy "authenticated read assessments"  on assessments for select using (auth.uid() is not null and is_active);

-- enrollments: super_admin all; org_admin reads their org's enrollments;
-- student reads + updates their own (limited fields).
create policy "super_admin all on enrollments"  on enrollments for all using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');
create policy "org_admin read enrollments in org" on enrollments for select using (
  auth_role() = 'org_admin'
  and student_id in (select id from profiles where org_id = auth_org())
);
create policy "student read own enrollments"    on enrollments for select using (auth_role() = 'student' and student_id = auth.uid());
-- student can mark their own enrollment complete (only completed_at — no other fields)
create policy "student complete own enrollment" on enrollments for update using (auth_role() = 'student' and student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and assessment_id is not distinct from (select assessment_id from enrollments e where e.id = enrollments.id)
    and phase is not distinct from (select phase from enrollments e where e.id = enrollments.id)
  );

-- Backfill: register the existing active-threat scenario as an assessment.
insert into assessments (code, name, kind, scenario_fk, is_active)
select 'active_threat_v1', title, 'scenario', id, is_active
  from scenarios
 where scenario_id = 'active_threat_v1'
on conflict (code) do nothing;
```

Apply via `npx supabase db push` (fall back to SQL editor + log if CLI auth balks).

Add 4 vitest cases in `tests/rls.spec.ts` (or `tests/rls-day3.spec.ts`):
- super_admin can insert/select/update/delete assessments ✓
- student can read active assessments ✓
- student can read own enrollment, can't read another student's ✗
- student can update `completed_at` on own enrollment but cannot change `student_id` / `phase` / `assessment_id` ✗

Run until green. If a policy is wrong, fix `0004_*.sql` in place and re-apply — don't stack a `0005_fix.sql`.

### Phase C — Orgs admin UI (~75 min)

Build a thin admin section for orgs. **Do not introduce a UI library** — use plain Tailwind 4 like the existing `src/components/admin/*` does. Follow existing patterns:

1. `src/app/mvs/admin/orgs/page.tsx` — list. Server Component. `requireSuperAdmin()` at top. Renders a table: name, type, status, deal value, # students, created. Each row links to detail. "+ New org" button → `/mvs/admin/orgs/new`.

2. `src/app/mvs/admin/orgs/new/page.tsx` — create. Form posts to a server action `createOrg(formData)` in `src/actions/orgs.ts`. Fields: `name` (req), `type` (select: hospital, police, military, other), `contact_name`, `contact_email`, `status` (select: lead, active, completed, churned — default lead), `deal_value_cents` (number input → store as cents, but display as dollars in UI), `notes` (textarea). On success, redirect to detail page.

3. `src/app/mvs/admin/orgs/[id]/page.tsx` — detail. Two sections:
   - **CRM card** — editable form (server action `updateOrg(id, formData)`), same fields as create. Shows updated_at.
   - **Roster table** — `select * from profiles where org_id = id order by created_at desc`. Columns: name, email (need to join `auth.users` for email — use service-role client for this), role, joined date, # completed enrollments. "+ Invite students" button → opens an inline invite UI (Phase D) or links to `/mvs/admin/orgs/[id]/invite`.

4. Server actions in `src/actions/orgs.ts`: `createOrg`, `updateOrg`. Both call `requireSuperAdmin()` first. Use the service-role client for writes (consistent with the existing admin pattern).

5. Add an "Orgs" link to the existing `AdminDashboard` nav (wherever the tabs live in `src/components/admin/AdminDashboard.tsx`).

### Phase D — Bulk-invite students (~75 min)

1. `src/app/mvs/admin/orgs/[id]/invite/page.tsx` — page with one textarea and a submit button. Helper text: *"Paste one student per line: FirstName,LastName,email@example.com. Each gets a magic-link invite."*

2. Server action `inviteStudents(orgId, raw: string)` in `src/actions/orgs.ts`:
   - `requireSuperAdmin()` first.
   - Parse lines. Validate each: trim, skip blank, must have 3 comma-separated fields, email must match a basic regex. Collect parse errors per line.
   - For each valid row, in sequence (don't parallelize — Supabase Auth Admin API has rate limits and serialized errors are cleaner):
     - `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: '<APP_URL>/auth/callback?next=/app' })`. The trigger from migration 0002 creates a `profiles` row with `role='student'` automatically.
     - If invite returns "User already registered," fetch the existing user via `auth.admin.getUserById` and continue.
     - `update profiles set org_id = <orgId>, full_name = '<First Last>' where id = <user.id>`. If profile already has a different `org_id`, **don't overwrite** — surface as a conflict in the result.
     - Collect `{ email, status: 'invited' | 'already_exists_added_to_org' | 'conflict' | 'error', message }` per row.
   - Return aggregate result.

3. Page renders the result block under the form: success count, conflicts (with reason), errors (with line number + message). Don't lose the textarea contents on error.

4. Email branding caveat: until Day 7 (Resend), Supabase's default SMTP sends invite emails with whatever Supabase has configured — likely `noreply@mail.app.supabase.io` and unbranded subject. **Acceptable for v1 cohort prep.** If the doctor wants branded invites before Day 7, log to `needs_human.md` to switch Supabase SMTP to Resend earlier.

### Phase E — Subagent review (~20 min)

Launch a Task with this brief:

> Independently review the orgs admin UI + bulk invite on branch `feat/orgs-and-invite`. Specifically check: (1) Does any code path allow a non-super_admin to call `inviteStudents`, `createOrg`, or `updateOrg`? (2) Could the bulk invite escalate a student in another org to also belong to this org (the "conflict" branch — confirm it doesn't silently overwrite)? (3) Are server actions parsing the textarea defensively (CRLF, trailing whitespace, non-ASCII names, email injection like `foo@bar.com,extra` slipping through validation)? (4) Does the roster query on the detail page leak `auth.users` columns we don't want exposed (e.g., raw_app_meta_data)? (5) Does the assessments RLS policy combined with the student-update enrollment policy actually let a student mark their own enrollment complete from an authenticated client? Report findings with file:line references.

Address whatever it flags before commit.

### Phase F — Stop cleanly (~15 min)

1. Append `worklog.md` entry: what shipped, RLS test results, subagent findings, what's deferred, Day 4 plan.
2. Update `docs/needs_human.md` if anything new is blocking (e.g., Supabase SMTP branding).
3. `npm run build` — must pass.
4. Commit: `feat: orgs admin UI + bulk student invite via Supabase Auth`.
5. Push the branch.
6. Print chat summary: what's working, what subagent flagged + how addressed, what Day 4 will do (student portal `/app` + linking responses to enrollments).

**Do NOT** start Day 4 today.

## Day 3 acceptance criteria
- `0004_assessments_and_enrollments.sql` applied; active-threat scenario backfilled as an `assessment` row.
- RLS tests for new tables green.
- `/mvs/admin/orgs` list/detail/create/edit working as super_admin.
- Bulk invite of 3+ test emails to a freshly created org succeeds; magic-link emails arrive; clicked invite lands the new student on `/app` (which can be a placeholder page that says "Welcome — your enrollments will appear here on Day 4"), with `profiles.org_id` correctly populated.
- Conflict path tested: invite an email already belonging to another org → reported as conflict, not silently moved.
- Subagent findings recorded in `worklog.md`.
- `npm run build` passes; branch pushed.

## Things to watch
- **Don't break the existing admin tabs.** Summary, Responses, ScenarioBuilder, ResponseTagging, CSV export must still work post-merge.
- **`profiles` trigger race.** The auth.users insert trigger creates the profile row. After `inviteUserByEmail()` returns, the profile may not yet exist for a brief moment (the trigger is synchronous but it's worth a defensive `upsert` rather than naked `update` if you observe NULLs).
- **Service role for writes vs. authenticated for reads.** Admin server actions can keep using service role (the route is gated by `requireSuperAdmin()`). The roster query that joins `auth.users` for email *must* use service role — RLS would block it from authenticated clients.
- **Don't add a CSV uploader.** Textarea is enough for v1. CSV upload is Phase 2 cruft.

Go.
