-- 0004_assessments_and_enrollments.sql
-- Adds the assessments parent table (covering scenario-style + multi-choice
-- under one umbrella) and enrollments (assigning a student to phase x assessment).

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                                       -- 'active_threat_v1', 'mvs_test_bank_v1'
  name text not null,
  kind text not null check (kind in ('scenario','multi_choice')),
  scenario_fk uuid references scenarios(id) on delete restrict,    -- null when kind='multi_choice'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint scenario_required_when_scenario_kind
    check ((kind = 'scenario' and scenario_fk is not null)
        or (kind = 'multi_choice' and scenario_fk is null))
);
create index if not exists assessments_kind_idx on assessments(kind) where is_active;

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete restrict,
  phase text not null check (phase in ('pre','post','practice')),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  invited_email_sent_at timestamptz,
  reminder_sent_at timestamptz,
  completed_at timestamptz,
  unique(student_id, assessment_id, phase)
);
create index if not exists enrollments_student_idx on enrollments(student_id);
create index if not exists enrollments_assessment_idx on enrollments(assessment_id);
create index if not exists enrollments_due_idx on enrollments(due_at) where completed_at is null;

alter table assessments enable row level security;
alter table enrollments enable row level security;

-- assessments: super_admin manages; everyone authenticated can read active.
create policy "super_admin all on assessments"
  on assessments for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');
create policy "authenticated read assessments"
  on assessments for select
  using (auth.uid() is not null and is_active);

-- enrollments: super_admin all; org_admin reads their org's enrollments;
-- student reads + updates their own (limited fields).
create policy "super_admin all on enrollments"
  on enrollments for all
  using (auth_role() = 'super_admin')
  with check (auth_role() = 'super_admin');
create policy "org_admin read enrollments in org"
  on enrollments for select
  using (
    auth_role() = 'org_admin'
    and student_id in (select id from profiles where org_id = auth_org())
  );
create policy "student read own enrollments"
  on enrollments for select
  using (auth_role() = 'student' and student_id = auth.uid());
-- Student can mark their own enrollment complete. RLS gates the row;
-- a BEFORE UPDATE trigger pins the immutable fields (student_id,
-- assessment_id, phase, assigned_at) for non-super_admin updates. The
-- WITH CHECK subquery approach causes "infinite recursion in policy for
-- relation enrollments" in Postgres, so we use a trigger instead.
create policy "student update own enrollment"
  on enrollments for update
  using (auth_role() = 'student' and student_id = auth.uid())
  with check (student_id = auth.uid());

create or replace function lock_enrollment_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth_role() is distinct from 'super_admin' then
    new.student_id    := old.student_id;
    new.assessment_id := old.assessment_id;
    new.phase         := old.phase;
    new.assigned_at   := old.assigned_at;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_enrollment_immutable_fields_trigger on enrollments;
create trigger lock_enrollment_immutable_fields_trigger
  before update on enrollments
  for each row execute function lock_enrollment_immutable_fields();

-- Backfill: register the existing active-threat scenario as an assessment.
insert into assessments (code, name, kind, scenario_fk, is_active)
select 'active_threat_v1', title, 'scenario', id, is_active
  from scenarios
 where scenario_id = 'active_threat_v1'
on conflict (code) do nothing;
