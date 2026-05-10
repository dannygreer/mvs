-- 0010_enrollment_scores_view.sql
-- (Day 6 prompt called this 0007 but that slot's taken by Day 5's
-- multi_choice_test migration. Sequence kept linear.)
--
-- Read-only views exposing per-enrollment scoring + timing aggregates.
-- Used by both the super_admin dashboard and the new org_admin portal.
-- - Scenario enrollments: only timing fields populated; score fields null.
-- - Multi-choice enrollments: full score + pass per the doctor's 80% rubric.
--
-- IMPORTANT: Day 5's submitMcAssessment / submitMcAssessmentByToken stores
-- the question_id on responses_long as `q01`..`q50` (see src/actions/quiz.ts).
-- The join here strips the leading 'q' before casting to int and matching
-- mc_questions.sequence. Wrong format = silently zero correct_count.

create or replace view enrollment_scores as
with mc_correctness as (
  select
    rl.enrollment_id,
    rl.id as response_id,
    case
      when rl.option_selected is null then false
      when mo.is_correct = true       then true
      else                                 false
    end as is_correct
  from responses_long rl
  join enrollments e
    on e.id = rl.enrollment_id
  join assessments a
    on a.id = e.assessment_id
   and a.kind = 'multi_choice'
  join mc_questions q
    on q.assessment_id = a.id
   and q.sequence = nullif(regexp_replace(rl.question_id, '^q0*', ''), '')::int
  left join mc_options mo
    on mo.question_id = q.id
   and mo.label = rl.option_selected
)
select
  e.id                              as enrollment_id,
  e.student_id,
  p.org_id,
  e.assessment_id,
  a.code                            as assessment_code,
  a.kind                            as assessment_kind,
  e.phase,
  e.assigned_at,
  e.completed_at,
  -- Timing aggregates apply to every kind
  (select count(*)
     from responses_long rl
    where rl.enrollment_id = e.id) as response_count,
  (select count(*) filter (where timed_out)
     from responses_long rl
    where rl.enrollment_id = e.id) as timed_out_count,
  (select coalesce(sum(rt_ms), 0)
     from responses_long rl
    where rl.enrollment_id = e.id) as total_time_ms,
  (select round(avg(rt_ms))
     from responses_long rl
    where rl.enrollment_id = e.id) as avg_rt_ms,
  -- Score fields (multi_choice only)
  case when a.kind = 'multi_choice'
       then (select count(*) from mc_correctness c
              where c.enrollment_id = e.id and c.is_correct)
       else null end                as correct_count,
  case when a.kind = 'multi_choice'
       then (select count(*) from mc_questions q where q.assessment_id = a.id)
       else null end                as total_questions,
  case when a.kind = 'multi_choice'
       then round(
              (select count(*) from mc_correctness c
                where c.enrollment_id = e.id and c.is_correct)::numeric
              / nullif(
                  (select count(*) from mc_questions q where q.assessment_id = a.id),
                  0)
              * 100,
              1)
       else null end                as score_percent,
  case when a.kind = 'multi_choice'
       then (
         (select count(*) from mc_correctness c
           where c.enrollment_id = e.id and c.is_correct)::numeric
         / nullif(
             (select count(*) from mc_questions q where q.assessment_id = a.id),
             0)
       ) >= 0.8
       else null end                as pass
from enrollments e
join profiles p on p.id = e.student_id
join assessments a on a.id = e.assessment_id;

-- Per-org rollup (org_admin dashboard hits this in one query).
create or replace view org_assessment_rollup as
select
  p.org_id,
  es.assessment_id,
  es.assessment_code,
  es.assessment_kind,
  es.phase,
  count(*)                                                              as enrolled_count,
  count(*) filter (where es.completed_at is not null)                    as completed_count,
  count(*) filter (where es.pass is true)                                as passed_count,
  round(avg(es.score_percent) filter (where es.pass is not null), 1)     as avg_score_percent,
  round(avg(es.total_time_ms) filter (where es.completed_at is not null)) as avg_total_time_ms,
  round(avg(es.avg_rt_ms)     filter (where es.completed_at is not null)) as avg_rt_ms
from enrollment_scores es
join profiles p on p.id = es.student_id
group by p.org_id, es.assessment_id, es.assessment_code, es.assessment_kind, es.phase;

-- CRITICAL: views in Postgres default to security_definer (run as owner =
-- postgres), which bypasses RLS on the underlying tables. Without these
-- explicit security_invoker settings, an org_admin could read every other
-- org's enrollments via the view. See:
-- https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-invoker-views
alter view enrollment_scores set (security_invoker = true);
alter view org_assessment_rollup set (security_invoker = true);
