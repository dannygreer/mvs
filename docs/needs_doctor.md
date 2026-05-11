# Open Items — Needed From Dr. Scully

Updated: May 8, 2026

These are blockers for production-quality data. The platform can be built and the cohort can run without them, but the first cohort's results will use placeholders if these aren't delivered in time.

## Critical path (block accurate first cohort)

### 1. ~~Test Bank answer key — 50 questions~~ — RESOLVED 2026-05-08
- Doctor delivered `Test Bank Questions.docx` (cleaned text) + `Exam Answer Key and Rubric.docx` (answer key + 80% pass threshold + performance tiers).
- Seeded into `supabase/seeds/mc_test_bank_v1.sql` (idempotent; integrity check enforces 4 options + 1 correct per question).
- **Two flags worth Dr. Scully reviewing before cohort:**
  1. **Answer distribution skew.** 41 of 50 answers (82%) are option B. A test-savvy student could score 82% by picking B for everything. If this is intentional doctrine alignment (B is consistently positioned as the named MVS concept), confirm. Otherwise consider scrambling option positions.
  2. **Residual artifact in Q29.** Reads "The interact becomes reactive, system responsive. What is the FIRST missing?" — likely a stray find-replace artifact. Verify intended wording before launch.
- Rubric details (80% pass, four-tier performance bands, "outcome trap" disqualifier) captured in `Exam Answer Key and Rubric.docx` — implementation lands during admin polish (Day 9-10).

### 2. ~~Scenario Bank options + answers~~ — RESOLVED 2026-05-10; SEEDED 2026-05-11
- Doctor delivered `MVS Animated Scenario LMS Answer Architecture.docx` with **5 scenarios**: Conversation Velocity, Perception Narrowing, Escalation Loop, Team Velocity, Recovery Failure / Drift. Full options + correct labels included.
- **Decision (Danny, 2026-05-10):** 5 = complete v1 set. Larger randomized bank is explicit Phase 2 work; engine will support it natively but won't enable randomization for the first cohort.
- **Seed applied to prod 2026-05-11** via `supabase/seeds/scenarios_v1.sql`. 5 scenarios × 4 screens × 16 options × revisable commitment_mode. Assessments `scenario_*_v1` are `is_active=true` so super_admin can enroll students.

### 2b. NEW — Per-option marker tagging — **admin UI + scenarios READY 2026-05-11**
Phase 1 Freeze (per `docs/phase1_freeze.md`) introduces 8 event markers per response (escalation, narrowing, premature_commitment, sequencing_break, drift, intervention, recovery, governance_instability). Day 10 shipped the admin UI; Day 10.5 seeded the 5 new scenarios. Each option on each scenario screen now exposes an 8-checkbox grid in the Scenario Builder tab.
- For the 5 new scenarios: 80 options × 8 markers = 640 checkboxes (most false; only the doctrine-correct option per question typically fires markers — estimate 1 hour of focused work).
- For active_threat_v1: ~24 options × 8 markers, same shape — admin can tag now.
- **Until tagged:** `event_markers` JSONB on every event row defaults to `{}`. The analytics pipeline emits valid rows with empty marker sets; cohort dashboards just won't have marker-driven cuts until tagging is in.
- **MC option markers:** UI not yet wired (server action exists, sibling tab in admin needed). Lower priority since MC has no revision flow and analytics queries can still operate on scenario-option markers.
- **Status:** [NEEDS_DOCTOR — admin UI + scenarios ready, please tag at https://mentalvelocitysystem.com/mvs/admin once DNS lands]
- **Owner:** Dr. Scully

### 2c. NEW — Scenario classification tags — **admin UI READY 2026-05-11**
9 metadata tags per scenario (domain, compression_level, ambiguity, emotional_load, sensory_complexity, authority_conflict, time_pressure, casualty_complexity, governance_challenge). Defaulted in migration 0012 (active_threat_v1 backfilled to tactical/extreme/etc.); doctor confirms/refines via admin UI. Each scenario detail now has a "Scenario Metadata" panel at the top with 8 enum selects + 1 tri-state authority_conflict.
- **Status:** [NEEDS_DOCTOR — admin UI ready]
- **Owner:** Dr. Scully

### 2d. NEW — Commitment mode per scenario — **admin UI READY 2026-05-11**
Each scenario declares `commitment_mode` as either `locked` (no answer revision, used for tactical/military/medical) or `revisable` (revisions allowed and tracked, used for leadership/executive). Toggle is at the top of the scenario detail in the Scenario Builder tab. Server-side enforced: a `locked` scenario rejects any submission containing a revision, even with a tampered client.
- Default proposed: `active_threat_v1` = locked (backfilled); 5 new scenarios = revisable (set during Day 10.5 seed).
- **Status:** [NEEDS_DOCTOR — confirm defaults]
- **Owner:** Dr. Scully

## Important (block accurate analytics)

### 3. `response_category` taxonomy for the 50-question test
Existing scenarios use `controlled | acceptable | premature | unsafe` (already in `response_tags` table). Confirm the same taxonomy applies to multi-choice test answers, or define a different one.
- **Status:** [NEEDS_DOCTOR]
- **Owner:** Dr. Scully

### 4. Branching rules for new scenarios
Build Spec §11 references the validation path `S1_B > S2_A > S4_C > S5_B`. The existing active-threat scenario already implements branching. Confirm:
- For the 25 doctrine-locked scenarios, should they branch or stay linear?
- If branching: provide explicit `(scenario, option) → next_screen` map.
- **Status:** [NEEDS_DOCTOR]
- **Owner:** Dr. Scully

### 5. Time limits per question/screen
- Default time-limit value? (existing active-threat uses 30s for most steps, 10s for the final pressure step)
- Per-question or per-screen overrides for any of the new content?
- **Status:** [NEEDS_DOCTOR]

## Nice to have (block polished launch)

### 6. Brand assets
- Logo (SVG preferred)
- Color palette
- Font choice
- Trademark usage rules (CAC™, CLP™, MVS™, Human Performance Risk Control Infrastructure™)
- Photography or stock direction for marketing site
- **Status:** [NEEDS_DOCTOR]

### 7. First cohort details
- Org name, type, contact name + email
- Number of students + roster (`first_name, last_name, email`)
- In-person training date
- Pre-assessment open date / due date
- Post-assessment window
- **Status:** [NEEDS_DOCTOR]

### 8. Marketing copy
The Purpose doc is a starting point but needs sign-off on tone and final wording for the public landing page at mentalvelocitysystem.com. Specifically:
- Hero headline + subhead
- "Who it's for" — which markets/orgs to call out
- Bio for Dr. Scully
- CTA text
- **Status:** [NEEDS_DOCTOR]

### 9. Doctrine clarification — "Step N" indicator
The existing assessment shows a `Step {N}` label on each screen. Strictly per the doctrine ("no progress signals"), this could be considered a guidance signal. Confirm:
- Keep as-is
- Replace with non-numeric framing ("Continue")
- Remove entirely
- **Status:** [NEEDS_DOCTOR]
