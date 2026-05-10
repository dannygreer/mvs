# Scenarios — what we still need from Dr. Scully

*Copy/adapt the email below. Attach `docs/scenarios_template.csv`.*

---

**Subject:** MVS — last content piece for the LMS launch (the 25 scenarios)

Hi Kevin,

The certification exam (50 questions + answer key) you sent is in the system and working — students can take it pre/post and the platform captures every decision with reaction time. Thank you for that.

The last content piece we need to launch the full course is the **25 scenarios** from the doctrine-locked scenario bank. Your original doc gave us the scenario *prompts* and the four standardized questions, but we still need the four multiple-choice options (A/B/C/D) for each question and the correct-answer key — same as what you provided for the certification exam.

I've attached a CSV template (`scenarios_template.csv`) with everything pre-filled except the parts only you can write:

- All 25 scenario names and prompts are already in there
- All 4 standardized questions are already in there for each scenario (`What is the FIRST signal?` / `What stage of the system is occurring?` / `What is the FIRST correct action?` / `What must you avoid?`)
- Each row has 5 blank cells for you to fill in:
  - `option_A_text` — the text for option A
  - `option_B_text` — the text for option B
  - `option_C_text` — the text for option C
  - `option_D_text` — the text for option D
  - `correct_label_A_B_C_or_D` — type a single letter: A, B, C, or D

Open the file in Excel or Google Sheets — it's 100 rows total (25 scenarios × 4 questions per scenario). Filling in one row should take ~2 minutes once you're in the flow, so plan on roughly 2-3 hours of focused work end-to-end. Sort by scenario_num to keep your context coherent across the 4 questions per scenario.

A few notes from the doctrine:
- For "What is the FIRST signal?" — earliest detectable shift, not outcome.
- For "What is the FIRST correct action?" — only the first correct action, not all correct actions.
- Wrong answers should include at least one outcome-stage trap and one late-detection trap, per the authoring rules.

If you'd rather work in a Word doc like you did for the test bank, just let me know and I'll convert the template — but the spreadsheet is the lowest-friction format for content of this shape.

Once this lands, we seed it the same day, the cohort can run with the full curriculum, and we're feature-complete for v1.

Thanks Kevin —
Danny

---

## When the doctor sends it back

He'll either return:
- The CSV with cells filled in
- A Word doc in the same format as `Test Bank Questions.docx` + a separate answer key like `Exam Answer Key and Rubric.docx`

Either is fine — both parse easily into the seed file at `supabase/seeds/scenarios_v1.sql` (which Day 9 will write following the same pattern as `mc_test_bank_v1.sql`).

If he comes back with questions about the format, common ones to expect:
- *"Should every scenario branch?"* — No. v1 is linear (4 questions in sequence per scenario). Branching is Phase 2; schema already supports it but UI won't.
- *"Same time limit on every question?"* — Default 30 seconds per question to match the active-threat scenario. He can override per question if he wants — just add a column.
- *"What's `response_category`?"* — Optional per-option tag like `outcome_trap`, `late_detection`, `wrong_stage`. We can leave it blank for v1 and add later if he wants nuanced analytics.
