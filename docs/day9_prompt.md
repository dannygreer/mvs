# Day 9 Prompt — paste this into Claude Code (cwd = repo root)

You're working on the Mental Velocity System (MVS) LMS. Days 1-8 shipped the full architecture: auth + RLS, multi-tenant orgs, both assessment runners, org admin portal, scoring view, lifecycle email automation, marketing landing page, domain wiring.

**Day 9 is intentionally NOT new feature work.** The original plan had Day 9 as "seed the 25 doctrine-locked scenarios," but that's blocked on the doctor delivering options + answers (`docs/scenarios_template.csv` was sent to him; until it's back we have nothing to seed). We're pulling Day 10's content forward instead: **cohort readiness** — make the platform safe to put real students on. When the scenarios arrive, that becomes a focused mini-session (Day 9.5) inserted between this and Day 10's go-live.

Read these in order before any code:
1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/MVS_Project_Plan.md` §Day 10 (the cohort-prep block)
4. `worklog.md` — Days 1-8. **Look especially for any "Subagent flagged X but deferred" notes — Day 9 is the day to either resolve them or formally accept them.**
5. `docs/needs_doctor.md`
6. `docs/needs_human.md`

You are running with `--dangerously-skip-permissions`. Plan to work autonomously for **3 hours**.

## Branch
Branch from `main` as `feat/cohort-readiness`.

## Scope today

Six things, in roughly this order. Treat them as a checklist; reorder if a dependency surfaces.

1. **Error monitoring** — Sentry (free tier) wired into the app + cron + server actions.
2. **Database safety** — verify Supabase auto-backups, take a manual snapshot before the cohort.
3. **End-to-end QA matrix** — walk every role through every flow, file bugs as you find them, fix the critical ones, log the rest.
4. **Doctor's runbook** — single markdown doc the doctor (non-technical) can use to operate the platform without you. Saved at `docs/RUNBOOK_for_doctor.md`.
5. **Security review subagent** — production-readiness pass, not generic security.
6. **Polish punchlist** — small UI/UX rough edges discovered during QA. Time-box to ~30 min; everything else gets logged for Day 11+.

### Phase A — Foundation check (~10 min)
1. `git checkout main && git pull`. `git checkout -b feat/cohort-readiness`.
2. `npm install` → `npm run build`.
3. **Read the worklog carefully** for the past 6 days. List every "subagent flagged X" / "deferred" / "TODO" / "[NEEDS_DOCTOR]" / "log later" item you find. This is your raw material for Phase F's punchlist.
4. Confirm the test users from prior days are still alive (test super_admin + at least one org_admin + at least one student in the dev DB). If not, recreate them — you'll need them for Phase C.

### Phase B — Sentry + backup verification (~30 min)

#### B.1 Sentry setup
1. `npm install @sentry/nextjs@latest`.
2. Run the wizard: `npx @sentry/wizard@latest -i nextjs`. It writes `sentry.{client,server,edge}.config.ts`, updates `next.config.ts`, adds `instrumentation.ts`. **Verify each generated file plays nicely with Next 16's conventions** (the wizard targets latest stable; check that `instrumentation.ts` is the right file for Next 16 — read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/` if unsure).
3. Required env vars (add to `.env.local` and Vercel all 3 envs):
   - `SENTRY_AUTH_TOKEN` (for source map upload — wizard will prompt)
   - `NEXT_PUBLIC_SENTRY_DSN`
4. Configure scope: tag every event with `role` (super_admin/org_admin/student/anon) and `org_id` when authenticated. Do this in `sentry.server.config.ts` via `Sentry.setUser()` from a small helper invoked early in server actions and route handlers.
5. **Cron route gets explicit instrumentation.** In `src/app/api/cron/send-reminders/route.ts`, wrap the body in `Sentry.startSpan({ name: 'cron.send-reminders' }, ...)`. Catch + report send failures to Sentry but don't fail the cron run (continue processing other enrollments).
6. Don't capture request bodies (PII). Don't capture cookies (session leak risk).
7. Trigger a test error from `/mvs/admin` (a server action that throws on a feature flag) and verify it lands in Sentry. Then remove the test trigger.

#### B.2 Supabase backup
1. Verify in Supabase dashboard → Project Settings → Database that **automatic daily backups** are enabled (free tier: 7 days, paid: 30+).
2. Take an explicit manual snapshot via `npx supabase db dump --file supabase/snapshots/pre-cohort-$(date +%Y%m%d).sql` (or via dashboard if CLI auth balks). Commit the dump to the repo for now (small enough). Add a `.gitignore` entry preventing future automatic dumps from being committed.
3. Document the restore procedure in the doctor runbook (Phase D).

### Phase C — End-to-end QA matrix (~45 min)

Walk every flow as every role. **File bugs as you go in `docs/qa_findings.md`.** Mark severity: `crit` (blocks cohort), `high` (looks bad), `low` (polish).

The matrix:

| Role | Flow | Pass? |
|---|---|---|
| anon | `/` marketing page renders, contact form submits, lead lands in admin | |
| anon | `/take` legacy quiz still works → writes `responses_long` row with `enrollment_id IS NULL` | |
| anon | `/auth/login` → magic link → callback routes to correct portal | |
| super_admin | `/mvs/admin` Summary, Responses, ScenarioBuilder, ResponseTagging, CSV export, Leads, Orgs all render | |
| super_admin | Create org, invite an org_admin, bulk-invite 3 students, assign pre to each | |
| super_admin | All four lifecycle emails fire (assignment invite + 3 reminders) within expected windows | |
| super_admin | `/mvs/admin/cron/run` triggers a reminder pass without errors | |
| super_admin | CSV export wide + long both download and parse cleanly | |
| org_admin | `/org` shows their org only; roster + aggregate metrics render correctly | |
| org_admin | Cannot reach `/mvs/admin/*` (redirected) | |
| org_admin | Cannot see another org's data via direct URL/API call | |
| student | `/app` lists assigned enrollments | |
| student | Take scenario assessment → all `responses_long` rows have RT + enrollment_id + student_id; `completed_at` stamped | |
| student | Take multi-choice assessment → 50 rows in `responses_long`, RT plausible (>200ms <30000ms), correct count matches MC answer key | |
| student | Cannot replay a completed enrollment | |
| student | Cannot reach `/org` or `/mvs/admin` | |

For each crit bug found: fix it now. For high: fix if <15min, else log. For low: log all.

Critical question to verify on the MC flow: **the student client never receives `is_correct` or `response_category`** from `mc_options`. Open browser devtools → Network tab → take an MC assessment → inspect every API response and JSON payload. If `is_correct: true` shows up anywhere in the wire response, that's a Day-5 leak that must be fixed today.

### Phase D — Runbooks (~45 min)

#### D.1 Doctor's runbook — `docs/RUNBOOK_for_doctor.md`

Write this for Dr. Scully, who is non-technical. Sections:

1. **Logging in** — go to mentalvelocitysystem.com/auth/login, enter your email, click the link from your inbox. Done.
2. **Creating an organization** — `/mvs/admin/orgs/new`. Fields explained.
3. **Inviting an org admin** — go to org detail page, "Invite admin" form.
4. **Inviting students** — paste a list, one per line: `FirstName,LastName,email@example.com`.
5. **Assigning a pre or post assessment** — go to org detail, find student, click "Assign", pick assessment + phase + due date.
6. **What students see** — short walkthrough of the student experience so the doctor can answer questions.
7. **Reading scores** — `/mvs/admin/responses` for individual responses, `/mvs/admin` summary tab for aggregates, org detail page for per-org rollups, CSV export for downstream analysis.
8. **The 80% pass threshold** — explain it's hardcoded per his rubric; explain how to find who passed/failed at a glance.
9. **Editing scenarios or test bank questions** — for now: contact Danny. Future: scenario builder UI.
10. **What to do when something breaks** — first: refresh the page. Second: check `mentalvelocitysystem.com/healthz` (if it 200s, the app is up). Third: email Danny with what you were doing and any error text.
11. **Backup and recovery** — explain that Supabase auto-backs up daily; manual restore is Danny's job.

Keep it visual where possible (numbered steps, screenshots if you can capture them — `npx playwright codegen` against localhost works for quick screenshots saved to `docs/img/`).

#### D.2 Operator's runbook — `docs/RUNBOOK_for_danny.md`

For Danny (technical). Cover:
- How to add a super_admin (the SQL update query)
- How to manually trigger the cron
- How to apply a new migration
- How to roll back a deploy via Vercel
- How to restore from a Supabase backup
- How to view Sentry alerts
- Where each env var lives + which envs need it
- The `[NEEDS_DOCTOR]` and `[NEEDS_HUMAN]` markers across the codebase: where they live, what they unblock

### Phase E — Security review subagent (~30 min)

Launch a Task with this brief:

> Independently audit branch `feat/cohort-readiness` for production-cohort readiness. Specifically check:
> 1. Are there any exposed secrets in client-side code (search for `process.env.` outside server-only files; flag every match)?
> 2. Are there any unauthenticated routes that perform writes (besides `/api/leads` for the contact form)?
> 3. Does the cron endpoint reject requests without a valid `CRON_SECRET` (replay against it without the header and confirm 401)?
> 4. Does `/api/admin/export-csv` correctly require super_admin and not leak across orgs?
> 5. Are RLS policies still tight after all the migrations? Re-run `npm test` for the RLS suite — confirm green.
> 6. Is `is_correct` from `mc_options` ever sent to a non-super-admin client? Trace from the loader to the response payload.
> 7. Are there any console.log statements that print full email addresses, full names, or session tokens?
> 8. Do the email templates correctly escape user-supplied content (the lead's `message` field rendered in admin view)?
> Report findings with file:line. Mark each as crit/high/low.

Address all crit. Address high if quick. Log low.

### Phase F — Polish punchlist (~30 min)

From your worklog scan in Phase A and your QA bugs from Phase C, pick the highest-leverage 30 minutes of fixes. Don't try to clear the whole list — this is a time-boxed cleanup, not a polish marathon.

Common candidates:
- Loading states / spinners on slow server actions
- Empty-state copy that's missing
- Form-field error messages that are unhelpful
- Misaligned headers/cards from the inevitable Tailwind drift
- The legacy `quiz_results` table — still alive, no longer referenced anywhere productive. Don't drop it (it's data!) but move references out of `src/lib/db.ts` to a clearly-marked `legacy.ts` file.
- The `Step N` doctrine concern from `needs_doctor.md` #9 — if the doctor still hasn't decided, replace with a non-numeric framing on a feature flag.

### Phase G — Stop cleanly (~15 min)

1. Append `worklog.md`: what shipped, QA results matrix, Sentry test event link, snapshot file path, subagent findings, punchlist work done, what's still open.
2. Update `docs/needs_human.md` with the Sentry env vars Danny needs to add to Vercel and any new credentials.
3. Update `docs/needs_doctor.md` if Phase E surfaced anything new.
4. `npm run build` — must pass.
5. Commit: `chore: cohort readiness — monitoring, backups, runbooks, polish`.
6. Push.
7. Print chat summary: QA matrix pass/fail, Sentry status, runbook URLs, what blocks cohort go-live (probably: scenarios from doctor + cohort details from doctor + DNS propagation if not yet done).

**Do NOT** start Day 10 (cohort go-live) today. That's a deliberate, slower session with a real cohort waiting.

## Day 9 acceptance criteria
- Sentry initialized; test error captured; cron + server actions instrumented.
- Manual Supabase snapshot taken; auto-backup verified enabled.
- QA matrix walked end-to-end as every role; bugs filed in `docs/qa_findings.md`; all `crit` bugs fixed.
- `docs/RUNBOOK_for_doctor.md` and `docs/RUNBOOK_for_danny.md` exist and are non-trivial.
- Security subagent run; all `crit` findings addressed.
- ≤30 min of polish landed; rest queued for Day 11+.
- `npm run build` passes; branch pushed.

## Things to watch
- **The MC answer-key leak check is the most important QA item.** If `is_correct` ever lands in a student client's network response, that's the day's most expensive bug.
- **Don't let polish eat the day.** Time-box Phase F. The cohort doesn't care if a card has 2px of misalignment; they care that they can take the assessment.
- **Sentry on the cron is critical** — silent cron failures are the worst class of production bug because no one notices until a student misses an email.
- **Sentry should NOT capture PII.** Emails and names are PII. Use `Sentry.setUser({ id: auth.uid() })` not `{ email }`. Strip `email` and `full_name` from any captured request bodies via `beforeSend`.
- **The runbook is for the doctor's sanity, not yours.** If you find yourself writing `npm` or `cd` in the doctor's runbook, you've drifted into the wrong audience. Doctor uses URLs and forms; he doesn't use a terminal.

Go.
