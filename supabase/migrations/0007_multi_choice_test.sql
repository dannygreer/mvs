-- 0007_multi_choice_test.sql
-- Adds the multi-choice assessment type for the 50-question Test Bank.
-- Schema lands here. Real 50-question content + answer key in
-- supabase/seeds/mc_test_bank_v1.sql, applied separately after this migration.
--
-- Note: Day 5 prompt called this 0006 but 0006_widen_phase_check.sql was
-- already taken (added end of Day 4). Migration sequencing kept linear.

create table if not exists mc_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  sequence int not null,
  prompt text not null,
  time_limit_seconds int,
  unique(assessment_id, sequence)
);
create index if not exists mc_questions_assessment_idx on mc_questions(assessment_id, sequence);

create table if not exists mc_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references mc_questions(id) on delete cascade,
  label text not null check (label in ('A','B','C','D')),
  text text not null,
  is_correct boolean,                          -- populated by seed file
  response_category text,                      -- still NEEDS_DOCTOR for MC (docs/needs_doctor.md #3)
  unique(question_id, label)
);
create index if not exists mc_options_question_idx on mc_options(question_id);

alter table mc_questions enable row level security;
alter table mc_options   enable row level security;

create policy "super_admin all on mc_questions"
  on mc_questions for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');
create policy "super_admin all on mc_options"
  on mc_options for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');

-- Authenticated users can read questions/options for ACTIVE assessments only.
-- IMPORTANT: this policy lets students read the is_correct column. The
-- application-layer loader at src/lib/db.ts (loadMcQuestionsForStudent) MUST
-- only select id/label/text — never is_correct or response_category — to
-- prevent the answer key from leaking to the client. A vitest case in
-- tests/rls.spec.ts asserts the loader contract.
create policy "authenticated read mc_questions"
  on mc_questions for select
  using (
    auth.uid() is not null
    and assessment_id in (select id from assessments where is_active)
  );
create policy "authenticated read mc_options"
  on mc_options for select
  using (
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
