# Day 11.5 Prompt — Setup text refactor

Paste this into Claude Code (cwd = repo root). This is a focused ~1.5 hour session, not a full day.

## The problem

Day 10.5 seeded the 5 doctor-delivered scenarios by duplicating the same setup text across all 4 `scenario_screens` rows per scenario (varying only `screen_prompt`). The admin Scenario Builder shows `screen_text` in the screen-row preview, so all four rows look identical ("You have just experienced a high-pressure event. You move directly into the next..."). The data is correct (the prompts ARE distinct) but the admin UX is confusing and the storage is redundant.

**Active-threat is different** — it has a branching narrative where each screen's text genuinely evolves the story. That schema must stay intact.

## The fix

Promote setup text from the screen level to the scenario level for recognition-test scenarios. Add a `scenarios.setup_text` column, backfill it from Q1's screen_text for the 5 new scenarios, then null out the redundant per-screen text. Active-threat is untouched.

Read these in order before any code:
1. `AGENTS.md`
2. `CLAUDE.md`
3. `worklog.md` — especially Day 10.5 (the seed origin) and Day 11 (if it shipped)
4. `supabase/seeds/scenarios_v1.sql` — the source of the duplicated screen_text

You are running with `--dangerously-skip-permissions`. Plan for **~1.5 hours**.

## Branch
Branch from `main` as `feat/setup-text-refactor`.

## Scope today

Five focused things:

1. Migration to add `scenarios.setup_text` + backfill + null out redundant screen_text.
2. Type + data-access updates (`src/types/index.ts`, `src/lib/db.ts`).
3. Admin Scenario Builder UI: setup text shown once at scenario level; per-screen rows preview `screen_prompt`, not `screen_text`.
4. Student runner: scenarios with `setup_text` show it once on a Read screen before Q1, then go directly to questions (no setup repeat per question). Scenarios without `setup_text` (active-threat) preserve current behavior.
5. Subagent + manual verification.

### Phase A — Foundation check (~5 min)
1. `git checkout main && git pull`. `git checkout -b feat/setup-text-refactor`.
2. `npm install` → `npm run build`.
3. Check the next available migration number: `ls supabase/migrations/`. Use that number (likely 0011 if Day 11 hasn't shipped, 0012 if it has).
4. Confirm the problem: query `select screen_text from scenario_screens scr join scenarios s on s.id = scr.scenario_fk where s.scenario_id = 'recovery_drift_v1' order by sort_order`. Should return 4 identical rows. Confirms the redundancy we're fixing.

### Phase B — Migration (~15 min)

Create `supabase/migrations/00NN_setup_text_on_scenario.sql` (use the right number from Phase A):

```sql
-- 00NN_setup_text_on_scenario.sql
-- Promote scenario setup/context text from per-screen duplication to a single
-- scenario-level column. Recognition-test scenarios (Phase 1 Freeze content)
-- present the same setup across 4 questions; storing it 4x is wasteful and
-- confuses the admin Scenario Builder.
--
-- Active-threat scenario (scenario_id = 'active_threat_v1') is INTENTIONALLY
-- untouched — its per-screen text evolves the branching narrative and must
-- stay on scenario_screens.

alter table scenarios add column setup_text text;

-- Backfill: for the 5 Phase 1 Freeze scenarios, copy Q1's screen_text up to
-- the parent scenario's new setup_text column.
update scenarios s
   set setup_text = (
     select scr.screen_text
       from scenario_screens scr
      where scr.scenario_fk = s.id
      order by scr.sort_order
      limit 1
   )
 where s.scenario_id in (
   'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
   'team_velocity_v1','recovery_drift_v1'
 );

-- Null out the redundant per-screen text on those 5 scenarios (all 4 screens
-- per scenario now). Active-threat's screen_text is untouched.
update scenario_screens scr
   set screen_text = null
 where scr.scenario_fk in (
   select id from scenarios
    where scenario_id in (
      'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
      'team_velocity_v1','recovery_drift_v1'
    )
 );

-- Sanity check: every Phase 1 Freeze scenario now has setup_text populated
-- AND zero screens with non-null screen_text.
do $$
declare bad int;
begin
  select count(*) into bad from scenarios s
   where s.scenario_id in (
     'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
     'team_velocity_v1','recovery_drift_v1'
   )
     and (s.setup_text is null or s.setup_text = '');
  if bad > 0 then
    raise exception 'Setup text backfill failed: % scenarios have null setup_text', bad;
  end if;

  select count(*) into bad from scenario_screens scr
   join scenarios s on s.id = scr.scenario_fk
   where s.scenario_id in (
     'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
     'team_velocity_v1','recovery_drift_v1'
   )
     and scr.screen_text is not null;
  if bad > 0 then
    raise exception 'screen_text not nulled correctly: % rows still have text', bad;
  end if;
end$$;
```

Apply via `npx supabase db push`.

Verify:
```sql
select scenario_id, setup_text is not null as has_setup
  from scenarios
 order by scenario_id;
-- expect: active_threat_v1 = false; all 5 new scenarios = true

select s.scenario_id, count(*) filter (where scr.screen_text is not null) as screens_with_text
  from scenarios s
  join scenario_screens scr on scr.scenario_fk = s.id
 group by s.scenario_id;
-- expect: active_threat_v1 has 6 (or however many screens it has); all 5 new = 0
```

### Phase C — Types + data access (~15 min)

1. `src/types/index.ts` — add `setupText: string | null` to the Scenario type. Add it to wherever you transform DB rows into the typed `Scenario` object.

2. `src/lib/db.ts` — the function that loads a scenario (`getWalkInScenario` or `getScenarioByAssessmentId`) needs to include `setup_text` in the select and pass it through to the returned object.

3. If the admin server actions need it (for editing/displaying setup_text), add an `updateScenarioSetupText(scenarioId, text)` server action in whatever file holds the existing scenario-update actions.

### Phase D — Admin Scenario Builder UI (~20 min)

In whatever component renders the Scenario Builder tab (probably `src/components/admin/ScenarioBuilderTab.tsx`):

1. **New top-level section "Setup text"** — shown above or alongside the Scenario Metadata (Phase 1 Freeze) panel. Single textarea bound to `scenarios.setup_text`. Save via the new server action. Show only when the scenario has a `setup_text` value (the 5 new scenarios); for active-threat (no setup_text, branching narrative), HIDE this section entirely so it doesn't confuse the admin into thinking they should populate it.

2. **Per-screen row previews** — change the preview from `screen_text` to `screen_prompt`. So instead of all 4 rows showing "You have just experienced a high-pressure event..." they now show:
   - Q1: "What is the FIRST signal?"
   - Q2: "What stage of the system is occurring?"
   - Q3: "What is the FIRST correct action?"
   - Q4: "What must you avoid?"

3. **Inside each screen's edit panel** (when expanded): the `screen_text` field stays editable (for active-threat's branching narrative — non-null there). For scenarios where `screen_text` is null, the input should be hidden or clearly marked "(not used — this scenario uses setup_text)". Don't surprise the admin by letting them edit a field that won't display.

### Phase E — Student runner (~20 min)

In `src/components/quiz/Quiz.tsx`:

**Branch on which text source applies:**

- **If `scenario.setupText` is populated** (the 5 new scenarios):
  - Add a NEW initial step: `'setup'` — renders `setup_text` once in a Read-style screen with a "Continue" button. After Continue, go to `'answering'` for Q1. The four question screens render ONLY `screen.prompt` (no `screen_text`).
  - Step flow: `'title'` (if anonymous walk-in) → `'setup'` → `'answering'` (loops Q1→Q4) → `'results'`
  - Authenticated student path (Day 4): `'setup'` → `'answering'` → `'results'`

- **If `scenario.setupText` is null** (active-threat):
  - Original behavior: per-screen `screen_text` displayed on the Read step before each Answer step. No setup-once screen.
  - Step flow: `'title'` → `'reading'` (Q1) → `'answering'` (Q1) → `'reading'` (Q2) → ... → `'results'`

**Future hook:** when Day 11's video integration is live, the video player replaces the setup screen for scenarios that have BOTH `video_url` and `setup_text`. Logic: if `video_url` exists, play video (skip setup screen — video conveys context visually); if not but `setup_text` exists, show setup screen; if neither, fall through to per-screen text. Encode this priority in the step state machine cleanly so the three cases don't tangle.

### Phase F — Subagent + verification (~15 min)

Subagent brief:

> Independently review the setup_text refactor on branch `feat/setup-text-refactor`. Specifically:
> 1. Does the migration correctly leave `active_threat_v1`'s per-screen `screen_text` intact? Verify with a query.
> 2. Does the admin Scenario Builder now show four DISTINCT preview lines per scenario for the 5 new scenarios (one per `screen_prompt`)?
> 3. For active-threat in the admin, does the Setup Text section stay HIDDEN (avoiding the misleading "populate me" empty input)?
> 4. For a student taking `conversation_velocity_v1`: does the setup screen render once at the start, then NOT repeat between Q1-Q4?
> 5. For a student taking `active_threat_v1`: is the per-screen branching narrative still rendering before each question?
> 6. If Day 11's video player is also on this branch (or merged), does the setup screen correctly NOT show when `video_url` is populated (the video subsumes it)?
> Report findings with file:line references.

### Phase G — Stop cleanly (~10 min)

1. Append `worklog.md`: what shipped, migration number used, subagent findings, before/after admin screenshots if you grab them.
2. `npm run build` — must pass.
3. Commit: `refactor: promote scenario setup text from per-screen redundancy to scenario-level column`.
4. Push.
5. Print chat summary: admin builder is now sane for the 5 new scenarios; active-threat untouched; student UX unchanged for active-threat, cleaner for the 5 new.

## Acceptance criteria
- Migration applied; setup_text populated on 5 scenarios; screen_text nulled on those 5 scenarios' screens; active-threat untouched
- Admin Scenario Builder shows distinct prompt previews per row (no more 4-identical-rows confusion)
- Student runner shows setup once for new scenarios; per-screen narrative for active-threat
- All RLS / existing tests still green
- `npm run build` passes; branch pushed

## Things to watch
- **Active-threat is sacred.** It's the doctrine-locked behavioral scenario used for pre/post comparison. Its per-screen `screen_text` is real content, not redundancy. Migration MUST leave it alone.
- **Video integration interaction.** If Day 11 has shipped, this refactor needs to coexist cleanly with `video_url`. The runner's step state machine should have a clear priority: video > setup_text > per-screen text. Make this explicit in code, not implicit.
- **The admin "Setup Text" section should be HIDDEN for active-threat.** Showing an empty input for a scenario that doesn't use the field will confuse the admin into thinking they need to populate it. Conditional render based on whether the scenario's `setup_text` is non-null (or whether scenario_id matches active-threat — pick whichever feels cleaner).
- **Don't drop `screen_text` as a column.** Even though we null it for 5 scenarios, active-threat still uses it, and future branching scenarios (Phase 2) will too. The column stays; we're just no longer duplicating data into it for recognition-test scenarios.

Go.
