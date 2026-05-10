-- 0009_enrollment_secret_token.sql
-- Pivot: students no longer authenticate. Each enrollment gets a
-- non-guessable URL like /take/<secret_token> and the doctor distributes
-- those at the start of a session. The token IS the auth — token verifies
-- ownership of that one assessment instance.
--
-- Token is uuid v4, ~122 bits of entropy. Unique. Set on insert via default.
-- Existing rows get backfilled in the same migration.

alter table enrollments
  add column if not exists secret_token uuid not null default gen_random_uuid();

create unique index if not exists enrollments_secret_token_uniq
  on enrollments(secret_token);

-- Backfill any existing rows that might have somehow ended up with NULL.
update enrollments set secret_token = gen_random_uuid() where secret_token is null;
