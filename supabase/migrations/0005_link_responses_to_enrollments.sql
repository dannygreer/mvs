-- 0005_link_responses_to_enrollments.sql
-- Link the doctrine-locked response tables to enrollments + students.
-- Columns are nullable so existing legacy/anonymous rows are preserved.

alter table responses_long
  add column if not exists enrollment_id uuid references enrollments(id) on delete set null,
  add column if not exists student_id    uuid references profiles(id)    on delete set null;
create index if not exists responses_long_enrollment_idx on responses_long(enrollment_id);
create index if not exists responses_long_student_idx    on responses_long(student_id);

alter table responses_wide
  add column if not exists enrollment_id uuid references enrollments(id) on delete set null,
  add column if not exists student_id    uuid references profiles(id)    on delete set null;
create index if not exists responses_wide_enrollment_idx on responses_wide(enrollment_id);
create index if not exists responses_wide_student_idx    on responses_wide(student_id);

-- RLS additions. The 0003 super_admin policies stay; we layer student + org_admin access.

create policy "student insert own responses_long"
  on responses_long for insert
  with check (auth_role() = 'student' and student_id = auth.uid());
create policy "student select own responses_long"
  on responses_long for select
  using (auth_role() = 'student' and student_id = auth.uid());

create policy "student insert own responses_wide"
  on responses_wide for insert
  with check (auth_role() = 'student' and student_id = auth.uid());
create policy "student select own responses_wide"
  on responses_wide for select
  using (auth_role() = 'student' and student_id = auth.uid());

create policy "org_admin read responses_long in org"
  on responses_long for select
  using (
    auth_role() = 'org_admin'
    and student_id in (select id from profiles where org_id = auth_org())
  );
create policy "org_admin read responses_wide in org"
  on responses_wide for select
  using (
    auth_role() = 'org_admin'
    and student_id in (select id from profiles where org_id = auth_org())
  );
