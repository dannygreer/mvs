-- Sample-data seed: 3 orgs × 20 students, full Phase 1/2/3 completions.
--
-- Idempotent: re-running wipes the prior `sample_2026_05` batch (tagged in
-- auth.users.raw_app_meta_data->>'seed_batch' and orgs.notes) before
-- inserting a fresh copy. Safe to re-run any number of times.
--
-- Performance model:
--   Phase 1 (pre)  - first RT ~2.5s (less deliberation),
--                    markers fire ~50% per option,
--                    branch paths weighted to premature/unsafe.
--   Phase 2 (post) - first RT ~5.5s (more deliberation = good per doctrine),
--                    markers fire ~15% per option,
--                    branch paths weighted to safer A/D options.
--   Phase 3 cert   - per-student tier bucket from hashval bucket:
--                    25% high (>=90), 35% certified, 15% borderline, 25% not_certified.
--   Phase 3 video  - 5 scenarios, 4 long events each, no markers.
--
-- Run via the Supabase MCP execute_sql or psql against the project DB.

------------------------------------------------------------------
-- 0. Cleanup any prior batch
------------------------------------------------------------------
delete from auth.users where raw_app_meta_data->>'seed_batch' = 'sample_2026_05';
delete from orgs where notes = 'seed_batch:sample_2026_05';

------------------------------------------------------------------
-- 1. Three orgs
------------------------------------------------------------------
insert into orgs (name, type, contact_name, contact_email, status, deal_value_cents, notes)
values
  ('Mercy General Hospital',     'hospital', 'Dr. Anita Reyes',   'a.reyes@mercygeneral.test',   'active', 4500000, 'seed_batch:sample_2026_05'),
  ('Pacific Pines Police Dept',  'police',   'Chief Marcus Hill', 'mhill@pacificpinespd.test',   'active', 3200000, 'seed_batch:sample_2026_05'),
  ('Northridge Fire & Rescue',   'other',    'Captain Jen Wong',  'jwong@northridgefr.test',     'active', 2800000, 'seed_batch:sample_2026_05');

------------------------------------------------------------------
-- 2. 60 students (20 per org). auth.users insert fires the
--    on_auth_user_created trigger which provisions profiles row.
------------------------------------------------------------------
do $$
declare
  org_rec record;
  i int;
  uid uuid;
  first_names text[] := array[
    'Alex','Blair','Casey','Dana','Eli','Frankie','Gabe','Harper','Indra','Jamie',
    'Kai','Logan','Morgan','Noor','Owen','Parker','Quinn','Riley','Sam','Tatum',
    'Uri','Val','Wren','Xan','Yael','Zion','Avery','Bo','Cleo','Drew',
    'Emery','Fox','Gray','Hayden','Iris','Jules','Kit','Lane','Marlo','Nico'
  ];
  last_names text[] := array[
    'Adams','Brooks','Cohen','Diaz','Ellis','Foster','Garcia','Hayes','Iyer','Jain',
    'Khan','Lopez','Mehta','Nguyen','Obi','Patel','Quinn','Reed','Singh','Tran',
    'Underwood','Vargas','Walsh','Xu','Yang','Zhang','Ali','Brown','Chen','Davis',
    'Evans','Ford','Green','Hall','Ibarra','Jones','King','Lee','Moore','Nash'
  ];
  role_groups text[] := array['nurse','er_resident','attending_physician','officer','sergeant','dispatcher','firefighter','paramedic'];
  fname text;
  lname text;
  rg text;
  yrs int;
  fullname text;
  email_addr text;
begin
  for org_rec in select id, name from orgs where notes = 'seed_batch:sample_2026_05' order by name loop
    for i in 1..20 loop
      uid := gen_random_uuid();
      fname := first_names[((i - 1 + abs(hashtext(org_rec.name::text))) % array_length(first_names,1)) + 1];
      lname := last_names[((i * 7 + abs(hashtext(org_rec.name::text))) % array_length(last_names,1)) + 1];
      fullname := fname || ' ' || lname;
      rg := role_groups[((i + abs(hashtext(org_rec.name::text))) % array_length(role_groups,1)) + 1];
      yrs := 1 + ((i * 3 + abs(hashtext(org_rec.name::text))) % 18);
      email_addr := lower(replace(org_rec.name::text, ' ', '_')) || '_' || i || '@mvs.test';

      insert into auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, is_sso_user, is_anonymous
      ) values (
        '00000000-0000-0000-0000-000000000000',
        uid,
        'authenticated',
        'authenticated',
        email_addr,
        '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTU',
        now() - (interval '1 day' * (10 + (i % 5))),
        jsonb_build_object('provider','email','providers',array['email'],'seed_batch','sample_2026_05'),
        jsonb_build_object('full_name', fullname),
        now() - (interval '1 day' * (10 + (i % 5))),
        now() - (interval '1 day' * (10 + (i % 5))),
        false,
        false
      );

      update profiles
         set org_id = org_rec.id,
             full_name = fullname,
             role_group = rg,
             experience_years = yrs
       where id = uid;
    end loop;
  end loop;
end $$;

------------------------------------------------------------------
-- 3. Phase 1 (pre) + Phase 2 (post) for active_threat_v1
------------------------------------------------------------------
do $$
declare
  asmt_id uuid := (select id from assessments where code = 'active_threat_v1');
  scen_ver text := 'v1';
  scen_code text := 'active_threat_v1';
  prof record;
  enr_id uuid;
  q_idx int;
  qid text;
  rt int;
  branch_path_pre text;
  branch_path_post text;
  picked text;
  markers jsonb;
  base_completed_pre timestamptz;
  base_completed_post timestamptz;
  marker_keys text[] := array[
    'escalation','narrowing','premature_commitment','sequencing_break',
    'drift','intervention','recovery','governance_instability'
  ];
  m text;
  m_idx int;
  hashval int;
begin
  for prof in
    select p.id, p.full_name
      from profiles p
      join auth.users u on u.id = p.id
     where u.raw_app_meta_data->>'seed_batch' = 'sample_2026_05'
     order by p.id
  loop
    hashval := abs(hashtext(prof.id::text));
    base_completed_pre := now() - interval '7 days' + (interval '1 hour' * (hashval % 24));
    base_completed_post := now() - interval '1 day' + (interval '1 minute' * (hashval % 480));

    -- PRE
    enr_id := gen_random_uuid();
    branch_path_pre := (array['CCC','CCB','BCB','DBB','BCC'])[((hashval) % 5) + 1];

    insert into enrollments (id, student_id, assessment_id, phase, assigned_at, invited_email_sent_at, completed_at)
    values (enr_id, prof.id, asmt_id, 'pre',
            base_completed_pre - interval '3 days',
            base_completed_pre - interval '2 days 12 hours',
            base_completed_pre);

    insert into responses_wide (
      participant_id, first_name, last_name, phase, scenario_id, scenario_version,
      q1_answer, q1_rt, q2_answer, q2_rt, q3_answer, q3_rt,
      q4_answer, q4_rt, q5_answer, q5_rt, q6_answer, q6_rt,
      total_time, branch_path, completed_at, enrollment_id, student_id, outcome_state
    ) values (
      prof.id::text, split_part(prof.full_name,' ',1), split_part(prof.full_name,' ',2),
      'pre', scen_code, scen_ver,
      substr(branch_path_pre,1,1), 2200 + (hashval % 1200),
      substr(branch_path_pre,2,1), 1800 + (hashval % 1500),
      substr(branch_path_pre,3,1), 2500 + (hashval % 1800),
      'B', 3000 + (hashval % 2000),
      'C', 2800 + (hashval % 1700),
      'B', 4200 + (hashval % 2200),
      18000 + (hashval % 12000), branch_path_pre, base_completed_pre,
      enr_id, prof.id, 'S6_FINAL_PRESSURE'
    );

    for q_idx in 1..6 loop
      qid := 'S' || q_idx;
      rt := case q_idx when 1 then 2200 + (hashval % 1200)
                       when 2 then 1800 + (hashval % 1500)
                       when 3 then 2500 + (hashval % 1800)
                       else 3000 + (hashval % 2000) end;
      picked := case q_idx
        when 1 then substr(branch_path_pre,1,1)
        when 2 then substr(branch_path_pre,2,1)
        when 3 then substr(branch_path_pre,3,1)
        else (array['A','B','C','D'])[((hashval + q_idx) % 4) + 1]
      end;
      markers := '{}'::jsonb;
      m_idx := 0;
      foreach m in array marker_keys loop
        m_idx := m_idx + 1;
        if ((hashval + q_idx * 17 + m_idx * 11) % 100) < 50 then
          markers := markers || jsonb_build_object(m, true);
        else
          markers := markers || jsonb_build_object(m, false);
        end if;
      end loop;
      insert into responses_long (
        participant_id, first_name, last_name, phase, scenario_id, scenario_version,
        question_id, option_selected, response_category, rt_ms, branch_path, timed_out,
        timestamp, event_markers, enrollment_id, student_id
      ) values (
        prof.id::text, split_part(prof.full_name,' ',1), split_part(prof.full_name,' ',2),
        'pre', scen_code, scen_ver,
        qid, picked, 'premature', rt, branch_path_pre, false,
        base_completed_pre - (interval '1 second' * (60 - q_idx * 8)),
        markers, enr_id, prof.id
      );
    end loop;

    -- POST
    enr_id := gen_random_uuid();
    branch_path_post := (array['AAA','AAB','ADA','DAA','DAD'])[((hashval) % 5) + 1];

    insert into enrollments (id, student_id, assessment_id, phase, assigned_at, invited_email_sent_at, completed_at)
    values (enr_id, prof.id, asmt_id, 'post',
            base_completed_post - interval '12 hours',
            base_completed_post - interval '6 hours',
            base_completed_post);

    insert into responses_wide (
      participant_id, first_name, last_name, phase, scenario_id, scenario_version,
      q1_answer, q1_rt, q2_answer, q2_rt, q3_answer, q3_rt,
      q4_answer, q4_rt, q5_answer, q5_rt, q6_answer, q6_rt,
      total_time, branch_path, completed_at, enrollment_id, student_id, outcome_state
    ) values (
      prof.id::text, split_part(prof.full_name,' ',1), split_part(prof.full_name,' ',2),
      'post', scen_code, scen_ver,
      substr(branch_path_post,1,1), 5200 + (hashval % 1500),
      substr(branch_path_post,2,1), 4800 + (hashval % 1800),
      substr(branch_path_post,3,1), 5500 + (hashval % 1700),
      'A', 4000 + (hashval % 1400),
      'A', 3800 + (hashval % 1500),
      'A', 4500 + (hashval % 1700),
      28000 + (hashval % 8000), branch_path_post, base_completed_post,
      enr_id, prof.id, 'S6_FINAL_PRESSURE'
    );

    for q_idx in 1..6 loop
      qid := 'S' || q_idx;
      rt := case q_idx when 1 then 5200 + (hashval % 1500)
                       when 2 then 4800 + (hashval % 1800)
                       when 3 then 5500 + (hashval % 1700)
                       else 4000 + (hashval % 1500) end;
      picked := case q_idx
        when 1 then substr(branch_path_post,1,1)
        when 2 then substr(branch_path_post,2,1)
        when 3 then substr(branch_path_post,3,1)
        else 'A'
      end;
      markers := '{}'::jsonb;
      m_idx := 0;
      foreach m in array marker_keys loop
        m_idx := m_idx + 1;
        if ((hashval + q_idx * 23 + m_idx * 7) % 100) < 15 then
          markers := markers || jsonb_build_object(m, true);
        else
          markers := markers || jsonb_build_object(m, false);
        end if;
      end loop;
      insert into responses_long (
        participant_id, first_name, last_name, phase, scenario_id, scenario_version,
        question_id, option_selected, response_category, rt_ms, branch_path, timed_out,
        timestamp, event_markers, enrollment_id, student_id
      ) values (
        prof.id::text, split_part(prof.full_name,' ',1), split_part(prof.full_name,' ',2),
        'post', scen_code, scen_ver,
        qid, picked, 'controlled', rt, branch_path_post, false,
        base_completed_post - (interval '1 second' * (60 - q_idx * 8)),
        markers, enr_id, prof.id
      );
    end loop;
  end loop;
end $$;

------------------------------------------------------------------
-- 4. Phase 3 - MC test bank (50 questions per student)
------------------------------------------------------------------
do $$
declare
  asmt_id uuid := (select id from assessments where code = 'mvs_test_bank_v1');
  prof record;
  enr_id uuid;
  qrow record;
  picked text;
  target_pct int;
  hashval int;
  base_completed timestamptz;
  q_seq int;
begin
  for prof in
    select p.id, p.full_name
      from profiles p
      join auth.users u on u.id = p.id
     where u.raw_app_meta_data->>'seed_batch' = 'sample_2026_05'
     order by p.id
  loop
    hashval := abs(hashtext(prof.id::text));
    base_completed := now() - interval '12 hours' + (interval '1 minute' * (hashval % 480));

    target_pct := case
      when (hashval % 100) < 25 then 92
      when (hashval % 100) < 60 then 84
      when (hashval % 100) < 75 then 74
      else 60
    end;

    enr_id := gen_random_uuid();
    insert into enrollments (id, student_id, assessment_id, phase, assigned_at, invited_email_sent_at, completed_at)
    values (enr_id, prof.id, asmt_id, 'post',
            base_completed - interval '6 hours',
            base_completed - interval '5 hours',
            base_completed);

    for qrow in
      select q.id, q.sequence,
             (select label from mc_options o where o.question_id = q.id and o.is_correct = true limit 1) as correct_label,
             array(select label from mc_options o where o.question_id = q.id and (o.is_correct is null or o.is_correct = false) order by label) as wrong_labels
        from mc_questions q
       where q.assessment_id = asmt_id
       order by q.sequence
    loop
      if ((hashval + qrow.sequence * 7) % 100) < target_pct then
        picked := qrow.correct_label;
      else
        picked := qrow.wrong_labels[((hashval + qrow.sequence) % greatest(array_length(qrow.wrong_labels,1),1)) + 1];
      end if;

      q_seq := qrow.sequence;
      insert into responses_long (
        participant_id, first_name, last_name, phase, scenario_id, scenario_version,
        question_id, option_selected, response_category, rt_ms, branch_path, timed_out,
        timestamp, event_markers, enrollment_id, student_id
      ) values (
        prof.id::text, split_part(prof.full_name,' ',1), split_part(prof.full_name,' ',2),
        'post', 'mvs_test_bank_v1', 'v1',
        'q' || lpad(q_seq::text, 2, '0'), picked,
        case when picked = qrow.correct_label then 'controlled' else 'unsafe' end,
        4500 + ((hashval + q_seq * 13) % 4000), '', false,
        base_completed - (interval '1 second' * (50 - q_seq) * 8),
        '{}'::jsonb, enr_id, prof.id
      );
    end loop;
  end loop;
end $$;

------------------------------------------------------------------
-- 5. Phase 3 - 5 video scenarios (1 enrollment + 4 long events each)
------------------------------------------------------------------
do $$
declare
  scen_codes text[] := array[
    'scenario_conversation_velocity_v1',
    'scenario_perception_narrowing_v1',
    'scenario_escalation_loop_v1',
    'scenario_team_velocity_v1',
    'scenario_recovery_drift_v1'
  ];
  prof record;
  asmt record;
  enr_id uuid;
  hashval int;
  base_completed timestamptz;
  picked text;
  q_idx int;
  rt int;
  asmt_idx int;
begin
  for prof in
    select p.id, p.full_name
      from profiles p
      join auth.users u on u.id = p.id
     where u.raw_app_meta_data->>'seed_batch' = 'sample_2026_05'
     order by p.id
  loop
    hashval := abs(hashtext(prof.id::text));
    asmt_idx := 0;
    for asmt in
      select id, code from assessments where code = any(scen_codes) order by code
    loop
      asmt_idx := asmt_idx + 1;
      enr_id := gen_random_uuid();
      base_completed := now() - interval '6 hours' + (interval '1 minute' * ((hashval + asmt_idx * 13) % 240));

      insert into enrollments (id, student_id, assessment_id, phase, assigned_at, invited_email_sent_at, completed_at)
      values (enr_id, prof.id, asmt.id, 'post',
              base_completed - interval '4 hours',
              base_completed - interval '3 hours',
              base_completed);

      insert into responses_wide (
        participant_id, first_name, last_name, phase, scenario_id, scenario_version,
        q1_answer, q1_rt, q2_answer, q2_rt, q3_answer, q3_rt,
        q4_answer, q4_rt, q5_answer, q5_rt, q6_answer, q6_rt,
        total_time, branch_path, completed_at, enrollment_id, student_id, outcome_state
      ) values (
        prof.id::text, split_part(prof.full_name,' ',1), split_part(prof.full_name,' ',2),
        'post', replace(asmt.code, 'scenario_', ''), 'v1',
        (array['A','B','C','D'])[((hashval + asmt_idx) % 4) + 1], 4200 + ((hashval + asmt_idx) % 1800),
        (array['A','B','C','D'])[((hashval + asmt_idx * 2) % 4) + 1], 4500 + ((hashval + asmt_idx * 3) % 1700),
        (array['A','B','C','D'])[((hashval + asmt_idx * 3) % 4) + 1], 4100 + ((hashval + asmt_idx * 5) % 1600),
        (array['A','B','C','D'])[((hashval + asmt_idx * 4) % 4) + 1], 4700 + ((hashval + asmt_idx * 7) % 1500),
        null, null, null, null,
        18000 + ((hashval + asmt_idx) % 6000), '', base_completed,
        enr_id, prof.id, 'Q4'
      );

      for q_idx in 1..4 loop
        picked := (array['A','B','C','D'])[((hashval + asmt_idx + q_idx) % 4) + 1];
        rt := 4000 + ((hashval + q_idx * 11 + asmt_idx * 5) % 2000);
        insert into responses_long (
          participant_id, first_name, last_name, phase, scenario_id, scenario_version,
          question_id, option_selected, response_category, rt_ms, branch_path, timed_out,
          timestamp, event_markers, enrollment_id, student_id
        ) values (
          prof.id::text, split_part(prof.full_name,' ',1), split_part(prof.full_name,' ',2),
          'post', replace(asmt.code, 'scenario_', ''), 'v1',
          'Q' || q_idx, picked, 'acceptable', rt, '', false,
          base_completed - (interval '1 second' * (30 - q_idx * 6)),
          '{}'::jsonb, enr_id, prof.id
        );
      end loop;
    end loop;
  end loop;
end $$;
