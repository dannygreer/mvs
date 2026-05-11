# Day 10.5 Prompt — Seed the 5 scenarios + resolve getActiveScenario gap

Paste this into Claude Code (cwd = repo root). This is a **focused ~60-90 min session**, not a full day.

Days 1-10 shipped the full operational platform + Phase 1 Freeze (multi-marker events, commitment_mode, scenario tags, revisable runner UX). Today seeds the 5 doctor-delivered scenarios into the live DB and resolves the `getActiveScenario()` known gap from Day 10's handoff notes.

Read these before any code:
1. `CLAUDE.md`
2. `docs/phase1_freeze.md` — current architecture spec
3. `worklog.md` — especially Day 10's "Known gaps" section
4. `supabase/seeds/scenarios_v1.sql` — the seed file already authored, ready to apply

You're running with `--dangerously-skip-permissions`. Plan for **60-90 min**.

## Branch
Branch from `main` as `feat/seed-scenarios-v1`.

## Scope today — three focused things

1. Apply `supabase/seeds/scenarios_v1.sql` to prod Supabase. Verify integrity.
2. Resolve the `getActiveScenario()` tag-map mismatch (known gap from Day 10) — the anonymous walk-in path at `/take` must continue to serve only `active_threat_v1` even with 5 new scenarios in the DB.
3. End-to-end test: a student takes one of the new scenarios via authenticated enrollment, all data lands correctly with markers + commitment_mode honored.

### Phase A — Foundation check (~10 min)

1. `git checkout main && git pull`. `git checkout -b feat/seed-scenarios-v1`.
2. `npm install` → `npm run build`. Must pass.
3. Verify `supabase/migrations/0012_phase1_freeze.sql` (or whatever the Day 10 migration was actually numbered) is applied to prod. Quick check:
   ```sql
   select column_name from information_schema.columns
    where table_name = 'scenarios' and column_name in ('commitment_mode','domain','compression_level');
   ```
   Should return 3 rows. If not, Day 10's migration hasn't landed in prod — log and stop.
4. Open `supabase/seeds/scenarios_v1.sql` and skim. The file has a sanity check at the top that fails fast if Day 10's schema isn't there.

### Phase B — Apply the seed (~15 min)

1. Run `npx supabase db push` is NOT what we want here — seeds are not migrations. Apply via:
   ```bash
   psql "$DATABASE_URL" -f supabase/seeds/scenarios_v1.sql
   ```
   Or paste into Supabase SQL editor if CLI auth is unreliable. The seed is idempotent (begins with deletes scoped to the 5 new scenario_ids).
2. Verify post-apply:
   ```sql
   -- 5 new scenarios
   select scenario_id, title, commitment_mode, is_active, domain
     from scenarios
    where scenario_id in (
      'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
      'team_velocity_v1','recovery_drift_v1'
    )
    order by scenario_id;
   -- expect: 5 rows, commitment_mode='revisable', is_active=false, domain='leadership'

   -- 5 new assessments
   select code, name, kind, is_active from assessments
    where code like 'scenario_%_v1'
    order by code;
   -- expect: 5 rows, kind='scenario', is_active=true

   -- 20 screens (4 per scenario × 5)
   select scenario_fk, count(*)
     from scenario_screens
     join scenarios on scenarios.id = scenario_screens.scenario_fk
    where scenarios.scenario_id like '%_v1'
      and scenarios.scenario_id <> 'active_threat_v1'
    group by scenario_fk;
   -- expect: 5 rows, each with count=4

   -- 80 options (16 per scenario × 5)
   select count(*) from screen_options o
    join scenario_screens scr on scr.id = o.screen_fk
    join scenarios s on s.id = scr.scenario_fk
    where s.scenario_id in (
      'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
      'team_velocity_v1','recovery_drift_v1'
    );
   -- expect: 80
   ```
3. Confirm the seed's integrity check passed (the seed itself `raise exception`s if not).

### Phase C — Resolve `getActiveScenario()` gap (~25 min)

Day 10's handoff flagged: `getActiveScenario()` for tag-map mismatches once a second scenario is active.

Current behavior (per `src/lib/db.ts`): `getActiveScenario()` selects from `scenarios where is_active = true limit 1`. It's used by the anonymous walk-in path at `/take` (or `/` if not moved yet).

Problem: with 5 new scenarios in the DB (even though seeded with `is_active=false`), any future toggle could trip this. And the function name is misleading — "active" is ambiguous between "active scenario for anonymous walk-in" vs "all available scenarios."

Refactor:

1. **Rename for clarity.** `getActiveScenario()` → `getWalkInScenario()`. Make the intent explicit. Update all call sites.
2. **Lock down the query.** Instead of `where is_active = true limit 1`, hard-target the active-threat scenario by code:
   ```ts
   .from('scenarios').select('*').eq('scenario_id', 'active_threat_v1').single()
   ```
   This makes the anonymous walk-in path explicitly bound to the active-threat baseline. Adding more scenarios won't accidentally swap the walk-in.
3. **Add a new function for the authenticated path:** `getScenarioByAssessmentId(assessmentId)` — used by `/app/take/[enrollmentId]` to fetch the right scenario for the enrollment. It joins `assessments → scenarios` via `assessment.scenario_fk`.
4. **Search-and-replace audit:**
   ```bash
   grep -rn "getActiveScenario" src/
   ```
   Update every caller. Most likely just the walk-in page; authenticated path should already be assessment-id-based per Day 4.

5. **Bonus polish if quick:** the walk-in path should NOT be reachable for authenticated students — the moment a student logs in, they should see `/app` not `/take`. Verify the proxy already does this; if not, add a redirect.

### Phase D — End-to-end test (~15 min)

1. As super_admin, create a fresh test enrollment for an existing test student against one of the new scenarios:
   ```sql
   insert into enrollments (student_id, assessment_id, phase)
   select p.id, a.id, 'post'
     from profiles p, assessments a
    where p.full_name ilike '%<your test name>%'
      and a.code = 'scenario_conversation_velocity_v1';
   ```
2. Sign in as the test student. Visit `/app`. Confirm the new enrollment appears.
3. Click Start. Verify:
   - Scenario context renders (the "You are in a conversation..." text)
   - Q1 with 4 options renders
   - **Because commitment_mode = 'revisable', the Continue/Change buttons appear after selection**
   - Pick an option → see "Locked in" state
   - Click Change → revise
   - Click Continue → advance to Q2
   - Complete Q2, Q3, Q4
4. Inspect `responses_long` for that enrollment:
   ```sql
   select question_id, option_selected, rt_ms, is_revision, revision_number,
          revises_response_event_id, event_markers
     from responses_long
    where enrollment_id = '<the new enrollment id>'
    order by sequence_number, revision_number;
   ```
5. Confirm:
   - At least 4 rows (one per question), more if you tested revisions
   - Revision rows have `is_revision=true`, `revision_number > 0`, `revises_response_event_id` pointing at the original
   - `event_markers` is `'{}'` for every row (no markers yet — doctor populates via admin UI later)
   - All `rt_ms` are plausible (>200, <30000)
6. Verify the walk-in path still works: visit `/take` (or `/`) as anon. Should serve `active_threat_v1`, not one of the new scenarios.

### Phase E — Stop cleanly (~10 min)

1. Append `worklog.md`: what shipped, integrity check results, the `getActiveScenario` refactor diff, end-to-end test outcomes.
2. Update `docs/needs_doctor.md`:
   - Mark item #2 fully resolved (seed applied, ready for marker tagging via admin UI)
   - Reinforce the marker-tagging ask: 80 options × 8 markers ≈ 640 checkboxes for the doctor across the 5 new scenarios (most will be unchecked; estimate ~1 hour of his time)
3. `npm run build` — must pass.
4. Commit: `feat: seed 5 doctor-delivered scenarios + refactor getActiveScenario → getWalkInScenario`.
5. Push.
6. Print chat summary: scenarios seeded, walk-in path locked to active-threat, end-to-end results, next session is cohort go-live prep.

## Day 10.5 acceptance criteria
- 5 new scenarios + 5 new assessments + 20 screens + 80 options present in prod DB
- Seed integrity check passes
- `getActiveScenario()` renamed to `getWalkInScenario()` and hard-bound to `active_threat_v1` by `scenario_id`
- Walk-in path at `/take` (or `/`) continues to serve only active-threat scenario
- A test student successfully completes one of the new scenarios with revision-mode UX
- `event_markers` JSONB defaults to `'{}'` (correct — doctor populates later)
- `npm run build` passes; branch pushed

## Things to watch
- **Migration number drift.** Day 10's handoff mentioned migration 0012 in prod. The seed file's sanity check just looks for the `commitment_mode` column, not a specific migration number — works regardless.
- **The 5 scenarios use `screen_id = 'Q1'..'Q4'` inside each scenario.** That's intentional — `screen_id` only needs to be unique within a scenario (via the unique constraint on `(scenario_fk, screen_id)`), not globally. Don't try to prefix them.
- **`response_tags` rows are NOT pre-populated** for these scenarios. The existing taxonomy (`controlled/acceptable/premature/unsafe`) was scenario-specific and authored for active-threat. The doctor's new architecture uses `event_markers` JSONB for richer per-event tagging. Don't try to backfill response_tags — they're being deprecated in favor of markers.
- **`is_correct` lives in `mc_options`, not `screen_options`.** For scenario assessments, "correctness" is captured via response_tags (the legacy way) or via tagged markers (the new way). The seed doesn't set is_correct on screen_options because that column doesn't exist there — the right correctness signal will emerge from the doctor populating markers like `intervention=true` and `recovery=true` on the doctrine-correct options.

Go.
