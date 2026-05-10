-- 0008_responses_long_unique_per_question.sql
-- Day 5 audit caught race-loser data poisoning: when two submissions race,
-- the loser's response_long inserts land BEFORE the atomic completion gate
-- rejects them, leaving 6-50 junk rows tagged with the (already-completed)
-- enrollment. Add a partial unique constraint on (enrollment_id, question_id)
-- for non-null enrollments so the race loser's INSERT fails, keeping the
-- table clean.
--
-- Partial because legacy rows have enrollment_id IS NULL and would violate
-- a global unique with each other.

create unique index if not exists responses_long_enrollment_question_uniq
  on responses_long (enrollment_id, question_id)
  where enrollment_id is not null;
