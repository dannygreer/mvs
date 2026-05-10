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

### 2. Scenario Bank options + answers — 25 scenarios × 4 questions = 100 questions
Each scenario in `Scenario_Bank_Doctrine_Locked.docx` provides the 4 standardized questions but no multiple-choice options for them. Need:
- 4 multiple-choice options for each of the 4 standardized questions per scenario (so 16 options per scenario, 400 total)
- Which option is correct
- Optionally: which "wrong" answers are *outcome-traps* vs *late-detection* (this populates `response_category`)
- **Status:** [NEEDS_DOCTOR]
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
