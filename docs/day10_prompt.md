# Day 10 Prompt — Phase 1 Freeze build

Paste this into Claude Code (cwd = repo root).

You're working on the Mental Velocity System (MVS) LMS. Days 1-9 shipped the full operational stack: auth + RLS, multi-tenant orgs, both assessment runners (scenario + multi-choice), org admin portal, scoring view, email automation, marketing landing page, Sentry + backups + runbooks. The doctor has now issued a Phase 1 Freeze (`docs/phase1_freeze.md`). Today (Day 10) we build the freeze items.

Read these in order before any code:
1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/phase1_freeze.md` — **the authoritative spec for today**
4. `worklog.md` — Days 1-9
5. `docs/needs_doctor.md`
6. `docs/needs_human.md`

You are running with `--dangerously-skip-permissions`. Plan to work autonomously for **3.5 hours**. Today is longer than usual because the work spans schema + runner + admin UI.

## Branch
Branch from `main` as `feat/phase1-freeze`.

## Doctrine — what's new

The doctor's Phase 1 Freeze adds three doctrinally-locked concepts to the event model:

1. **Each event can fire multiple independent markers** from a locked set of 8 (escalation, narrowing, premature_commitment, sequencing_break, drift, intervention, recovery, governance_instability).
2. **Each scenario has a `commitment_mode`** that determines whether students can revise answers. Locked = no revisions (current behavior). Revisable = revisions allowed and tracked as additional event rows.
3. **Each scenario carries 9 classification tags** for future cohort analytics.

These are additive. No existing scenario or response data changes shape. Backfill defaults; the doctor refines via admin UI after deploy.

## Scope today

Five things, in this order:

1. Migration `0009_phase1_freeze.sql` — new columns on `scenarios`, `screen_options`, `mc_options`, `responses_long`, plus backfilled defaults.
2. Runner: revisable mode UX + revision-event writing on the scenario runner.
3. Server actions: copy markers from selected option to event row at submit time.
4. Admin scenario builder: tag editors, commitment-mode toggle, per-option marker checkboxes.
5. Subagent review + RLS verification + end-to-end test.

### Phase A — Foundation (~10 min)
1. `git checkout main && git pull`. `git checkout -b feat/phase1-freeze`.
2. `npm install` → `npm run build`.
3. Read `docs/phase1_freeze.md` and confirm understanding of the marker set and commitment modes. Note the 8 marker keys exactly — they will be referenced in code many places.

### Phase B — Migration 0009 (~45 min)

Create `supabase/migrations/0009_phase1_freeze.sql`:

```sql
-- 0009_phase1_freeze.sql
-- Phase 1 Architecture Freeze per docs/phase1_freeze.md.
-- Additive only. No existing data is modified except for sensible defaults.

-- ============================================================
-- 1. SCENARIO CLASSIFICATION TAGS + COMMITMENT MODE
-- ============================================================
alter table scenarios
  add column commitment_mode text not null default 'locked'
    check (commitment_mode in ('locked','revisable')),
  add column domain text
    check (domain in ('tactical','medical','leadership','executive') or domain is null),
  add column compression_level text
    check (compression_level in ('low','moderate','high','extreme') or compression_level is null),
  add column ambiguity text
    check (ambiguity in ('low','moderate','high') or ambiguity is null),
  add column emotional_load text
    check (emotional_load in ('low','moderate','high') or emotional_load is null),
  add column sensory_complexity text
    check (sensory_complexity in ('low','moderate','high') or sensory_complexity is null),
  add column authority_conflict bool,
  add column time_pressure text
    check (time_pressure in ('low','moderate','high') or time_pressure is null),
  add column casualty_complexity text
    check (casualty_complexity in ('none','single','multiple','mass') or casualty_complexity is null),
  add column governance_challenge text
    check (governance_challenge in ('individual','team','organizational') or governance_challenge is null);

-- Backfill: active_threat_v1 → tactical / extreme / locked
update scenarios set
  commitment_mode = 'locked',
  domain = 'tactical',
  compression_level = 'extreme',
  ambiguity = 'moderate',
  emotional_load = 'high',
  sensory_complexity = 'high',
  authority_conflict = false,
  time_pressure = 'high',
  casualty_complexity = 'mass',
  governance_challenge = 'individual'
 where scenario_id = 'active_threat_v1';

-- ============================================================
-- 2. PER-OPTION MARKER TAGGING
-- One JSONB column per option table; keys are the 8 locked markers,
-- values are booleans. Default empty object = no markers fire.
-- ============================================================
alter table screen_options
  add column triggers_markers jsonb not null default '{}'::jsonb;

alter table mc_options
  add column triggers_markers jsonb not null default '{}'::jsonb;

-- Expression indexes for the 8 known marker keys (fast cohort queries later)
create index screen_options_marker_escalation_idx
  on screen_options ((triggers_markers ->> 'escalation'))
  where triggers_markers ->> 'escalation' = 'true';
create index screen_options_marker_narrowing_idx
  on screen_options ((triggers_markers ->> 'narrowing'))
  where triggers_markers ->> 'narrowing' = 'true';
create index screen_options_marker_premature_commitment_idx
  on screen_options ((triggers_markers ->> 'premature_commitment'))
  where triggers_markers ->> 'premature_commitment' = 'true';
create index screen_options_marker_sequencing_break_idx
  on screen_options ((triggers_markers ->> 'sequencing_break'))
  where triggers_markers ->> 'sequencing_break' = 'true';
create index screen_options_marker_drift_idx
  on screen_options ((triggers_markers ->> 'drift'))
  where triggers_markers ->> 'drift' = 'true';
create index screen_options_marker_intervention_idx
  on screen_options ((triggers_markers ->> 'intervention'))
  where triggers_markers ->> 'intervention' = 'true';
create index screen_options_marker_recovery_idx
  on screen_options ((triggers_markers ->> 'recovery'))
  where triggers_markers ->> 'recovery' = 'true';
create index screen_options_marker_governance_instability_idx
  on screen_options ((triggers_markers ->> 'governance_instability'))
  where triggers_markers ->> 'governance_instability' = 'true';

-- (Same indexes on mc_options — paste the eight indexes again with mc_options.)
-- ... (omitted for brevity; include in the actual migration)

-- ============================================================
-- 3. RESPONSES_LONG — markers, revisions, presented_options, outcome_state
-- ============================================================
alter table responses_long
  -- Markers actually triggered on this event (copied from selected option at submit time)
  add column event_markers jsonb not null default '{}'::jsonb,
  -- Snapshot of options shown at decision time (for analytic replay)
  add column presented_options jsonb,
  -- Revision tracking
  add column is_revision bool not null default false,
  add column revises_response_event_id bigint references responses_long(id) on delete set null,
  add column revision_number int not null default 0;
-- ^ revision_number: 0 = original commit, 1 = first revision, 2 = second revision, ...

-- Expression indexes for marker queries on events
create index responses_long_marker_escalation_idx
  on responses_long ((event_markers ->> 'escalation'))
  where event_markers ->> 'escalation' = 'true';
-- (repeat for the other 7 markers — same pattern)

-- Composite for "all revisions on this enrollment"
create index responses_long_revisions_idx
  on responses_long (enrollment_id, revises_response_event_id)
  where is_revision;

-- ============================================================
-- 4. RESPONSES_WIDE — outcome_state at session level
-- ============================================================
alter table responses_wide
  add column outcome_state text;
-- ^ terminal-screen ID for scenarios; null for multi-choice (the whole exam is the outcome)

-- ============================================================
-- 5. RLS
-- New columns inherit existing row-level policies (column-level RLS not needed
-- since markers, tags, revisions are all considered the same sensitivity as
-- the rows they live on). Verify no policy needs updating; run RLS test suite
-- after applying.
-- ============================================================
```

Apply via `npx supabase db push`. Re-run `npm test` (the RLS suite) — must remain green.

Add 6 new vitest cases:
- Insert a `responses_long` row with `event_markers = '{"escalation":true,"narrowing":true}'::jsonb` → reads back correctly via the expression-indexed query
- Revision linking: insert A (original, revision_number=0), then B revising A (revision_number=1, revises_response_event_id=A.id) → can query the chain
- `commitment_mode='locked'` blocks any insert with is_revision=true for a question already answered in that enrollment (enforced server-side; this test validates the server-action path, not RLS directly)
- Scenario tag enum: insert with `compression_level='invalid'` → constraint error
- `triggers_markers` on `screen_options` accepts the 8 known keys; unknown keys are allowed (modularity preserved) but flagged in a vitest warning
- Default `commitment_mode='locked'` applies to any future inserted scenario without explicit value

### Phase C — Runner changes (~75 min)

Two flows now: locked (current) and revisable (new).

**C.1 Detect commitment mode at runtime.** The scenario loader (`src/lib/db.ts` `getActiveScenario` or wherever the scenario is fetched) now returns `commitment_mode`. The `<Quiz>` component reads it and branches behavior.

**C.2 Locked mode — no change.** Existing flow stands. Auto-advance on click. `event_markers` JSONB gets populated by the server action (Phase D), not the runner.

**C.3 Revisable mode — new flow.** After a student clicks an option:

1. Visually lock the choice in: highlight the selected option, show "Locked in: {label}" state.
2. Show **two buttons** below: "Continue" (advances to next screen) and "Change answer" (re-opens the question for revision).
3. Clicking "Change answer" calls a new `revise()` handler that:
   - Records the current selection's timestamp as the revision moment
   - Visually unlocks the question
   - Resets `startTimeRef` for the next-revision RT capture (RT of revision = time from previous lock-in to new commit)
   - On the next click, fires `onResponse()` with a `previousResponseId` linking the new event row to the old one
4. Multiple revisions allowed; each is its own event row with incrementing `revision_number`.

**Defensive UI:** if commitment_mode is locked but the student somehow has an `is_revision=true` payload (devtools tampering), the server action MUST reject (Phase D handles this).

**Doctrine guard:** even in revisable mode, no "back to previous screen" navigation. Revisions apply only to the *current* screen. Once "Continue" is clicked, the screen is locked permanently.

**C.4 Reset state per screen.** When `currentScreenId` changes, `answeredRef.current` resets and `startTimeRef.current = Date.now()` (after paint). Already true for locked; verify for revisable.

### Phase D — Server actions: marker copying + revision validation (~45 min)

In `src/actions/quiz.ts`'s `submitAssessment` (and `submitMcAssessment`):

**D.1 Per-event marker copy.** For each response in the payload:
1. Look up the selected option's `triggers_markers` JSONB.
2. Copy it to the `event_markers` column of the new `responses_long` row.
3. Also snapshot `presented_options` (array of `{id, label, text}` for the options shown at that step).

**D.2 Revision handling.**
- Read the scenario's `commitment_mode`.
- If `commitment_mode = 'locked'` and ANY incoming response has `is_revision=true` → **reject the entire submission with 400**. Log to Sentry.
- If `commitment_mode = 'revisable'`:
  - Each revision row carries `revises_response_event_id` pointing at the prior event for the same question
  - Set `revision_number` correctly (0 for original, increment per revision)
  - All rows still go into `responses_long`; queries that want "final answer per question" filter by max(revision_number) per (enrollment_id, question_id)

**D.3 outcome_state.** Compute the terminal-screen ID once the scenario completes. Store on `responses_wide.outcome_state`. For multi-choice, leave null.

### Phase E — Admin scenario builder UI updates (~45 min)

Existing builder is `src/components/admin/ScenarioBuilderTab.tsx`. Add three editor sections per scenario:

**E.1 Scenario meta editor.** Top of the scenario detail view. 9 dropdowns (one per tag) + commitment_mode toggle. Save via existing server action; add an `updateScenarioMeta(scenarioId, fields)` if needed.

**E.2 Per-option marker editor.** For each option on each screen, show an 8-checkbox grid (escalation, narrowing, premature_commitment, sequencing_break, drift, intervention, recovery, governance_instability). On change, updates that option's `triggers_markers` JSONB.

**E.3 Read-only audit view.** For an existing enrollment with revisions, show the full revision chain in the responses tab so the doctor can see what happened. (Not strictly needed for v1, but small — ship if Phase E budget allows.)

### Phase F — Subagent review (~25 min)

Launch a Task with this brief:

> Independently review the Phase 1 Freeze build on branch `feat/phase1-freeze`. Specifically check:
> 1. Does the runner correctly enforce locked vs revisable per `scenarios.commitment_mode`? Can a locked scenario be tampered into accepting revisions via crafted client payload? Trace the server-action validation.
> 2. Does each `responses_long` row carry the correct `event_markers` JSONB copied from the selected option at submit time? Check the copy path is verbatim — not derived, not transformed.
> 3. Revision chain integrity: in revisable mode, are `revises_response_event_id` and `revision_number` populated correctly across multiple revisions on the same question?
> 4. RLS suite still green after migration 0009? Run `npm test`.
> 5. Does the admin scenario builder correctly save the 9 classification tags + commitment_mode + per-option markers? Read back and confirm.
> 6. Is the doctrine preserved in revisable mode? Specifically: no back-to-previous-screen navigation, no progress signals added to the revisable UI, reaction-time capture (paint→click) still client-side per the `useRef(Date.now())` pattern from `ScenarioScreen.tsx`.
> 7. `presented_options` snapshot — does it capture the options as displayed (including their order), not a re-derivation at write time?
> Report findings with file:line references.

Address findings. Items 1, 2, 3, 6 are real-data-integrity issues — fix before commit.

### Phase G — End-to-end test (~15 min)

1. Create a fresh student account, assign two enrollments: one for active_threat_v1 (locked) and one for "Conversation Velocity" (revisable, default).
2. Take active_threat_v1 → verify no "Change answer" button appears, behavior identical to today.
3. Take Conversation Velocity → click option B, see "Locked in: B" + Continue + Change. Click Change. Click option C. Click Continue. Two rows in `responses_long` for that question: original B (revision_number=0), revision C (revision_number=1, revises_response_event_id=B.id).
4. Verify markers: if the doctor (or your stub defaults) tagged option B with `narrowing=true`, the event row for that click should have `event_markers={"narrowing":true}`.
5. Verify presented_options is populated on every row.

### Phase H — Stop cleanly (~15 min)

1. Append `worklog.md`: what shipped, RLS test results, subagent findings, end-to-end results.
2. Update `docs/needs_doctor.md`:
   - Mark: scenarios from the doctor — RECEIVED (5 delivered 2026-05-10)
   - Add new ask: per-option marker tagging for the 5 new scenarios (admin UI ready for him to fill in)
   - Add new ask: confirm scenario classification tags for the 5 new scenarios
3. `npm run build` — must pass.
4. Commit: `feat: phase 1 freeze — multi-marker events, commitment modes, scenario tags`.
5. Push.
6. Print chat summary: what's working, what content the doctor still needs to populate in the admin UI, June 4 readiness status.

## Day 10 acceptance criteria
- `0009_phase1_freeze.sql` applied; all new columns + indexes present.
- `responses_long.event_markers` JSONB populated correctly on every new submission.
- Revisable scenarios allow revisions; locked scenarios reject them server-side.
- Revision chain queryable (max revision_number per (enrollment, question) = final answer).
- Admin scenario builder exposes the 9 tags, commitment_mode, and per-option marker checkboxes.
- RLS suite green; ≥6 new tests added covering marker queries and revision integrity.
- Subagent findings (1, 2, 3, 6) addressed.
- `npm run build` passes; branch pushed.

## Things to watch
- **JSONB query speed.** The expression indexes are critical for analytics queries. Verify the planner uses them: `explain analyze select count(*) from responses_long where event_markers ->> 'escalation' = 'true'` should show an index scan, not a seq scan.
- **Locked scenarios stay locked.** The single biggest doctrine risk in this build is letting a revision land on a locked scenario by mistake. Server-side enforcement is the only line of defense — UI doesn't count.
- **Reaction time on revisions.** Should `rt_ms` measure from screen-mount to click (full time) or from previous-lock-in to revision-click? Per the doctor's spec ("Revision latency"), the latter. Make sure the revision RT resets on "Change answer", not on screen mount.
- **Don't ship without backfilled defaults.** `commitment_mode='locked'` is the safe default for any new scenario — preserves current behavior.
- **The 5 new scenarios are not yet seeded.** They were delivered 2026-05-10 and are locked as the complete v1 set (Danny 2026-05-10 — see `docs/needs_doctor.md` #2). Day 10 doesn't seed them — that's a focused ~60-min session ("Day 10.5") immediately after Day 10 ships. Today is purely infrastructure.
- **Randomization is OFF for v1.** Schema supports a future larger bank with N-random selection, but no runtime randomization in v1. All 5 scenarios are presented to every student. Phase 2 expansion.

Go.
