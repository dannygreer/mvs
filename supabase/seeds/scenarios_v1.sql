-- Seed: MVS Animated Scenario Bank — 5 scenarios (v1)
-- Source: "MVS Animated Scenario LMS Answer Architecture.docx" (Dr. Scully, 2026-05-10)
-- Decision (Danny, 2026-05-10): 5 = complete v1 set. Larger bank is Phase 2.
-- Apply AFTER migration 0012 (Phase 1 Freeze) so classification tags + commitment_mode exist.
-- Idempotent: safe to re-run.
--
-- Defaults set today (doctor refines via admin UI post-deploy):
--   commitment_mode = 'revisable'  (leadership/executive doctrine per phase1_freeze.md)
--   classification tags = defaulted per Scully review (Danny's read, awaiting confirmation)
--   triggers_markers on every option = '{}' (doctor populates via admin per-option grid)
--   scenarios.is_active = FALSE  (anonymous walk-in continues to serve only active_threat_v1;
--                                  these are reached via authenticated enrollment paths only)
--   assessments.is_active = TRUE  (so super_admin can assign them as enrollments)
-- video_url = NULL on every screen (animation production handled separately)

begin;

-- Sanity check: phase 1 freeze schema must be present.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
     where table_name = 'scenarios' and column_name = 'commitment_mode'
  ) then
    raise exception 'commitment_mode column missing — apply migration 0012_phase1_freeze.sql first';
  end if;
end$$;

-- Clean any prior seed for these 5 scenarios (idempotent re-run support).
delete from screen_options where screen_fk in (
  select id from scenario_screens where scenario_fk in (
    select id from scenarios where scenario_id in (
      'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
      'team_velocity_v1','recovery_drift_v1'
    )
  )
);
delete from scenario_screens where scenario_fk in (
  select id from scenarios where scenario_id in (
    'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
    'team_velocity_v1','recovery_drift_v1'
  )
);
delete from assessments where code in (
  'scenario_conversation_velocity_v1','scenario_perception_narrowing_v1',
  'scenario_escalation_loop_v1','scenario_team_velocity_v1','scenario_recovery_drift_v1'
);
delete from scenarios where scenario_id in (
  'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
  'team_velocity_v1','recovery_drift_v1'
);

-- ============================================================
-- Helper: insert one scenario + 4 question screens + 16 options
-- + matching assessment row. All defaults consistent across scenarios.
-- ============================================================
do $$
declare
  s_id uuid;
  q1 uuid; q2 uuid; q3 uuid; q4 uuid;

  -- One pass per scenario. Verbose because there are 5 of them, but
  -- straightforward.

  -- Each scenario has the same shape:
  --   - 4 sequential screens (Q1..Q4), each with the same screen_text (scenario context)
  --     and a different screen_prompt (the doctrine question)
  --   - 4 options per screen, all pointing at the next screen's screen_id
  --   - Q4's options all have next_screen_id = NULL (terminal)
begin

  -- ============================================================
  -- SCENARIO 1 — Conversation Velocity
  -- ============================================================
  insert into scenarios (
    scenario_id, version, title, entry_screen_id, is_active,
    commitment_mode, domain, compression_level, ambiguity, emotional_load,
    sensory_complexity, authority_conflict, time_pressure, casualty_complexity,
    governance_challenge
  ) values (
    'conversation_velocity_v1', 'v1', 'Conversation Velocity', 'Q1', false,
    'revisable', 'leadership', 'moderate', 'moderate', 'low',
    'low', false, 'moderate', 'none', 'individual'
  ) returning id into s_id;

  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q1',
     'You are in a conversation. The other person asks a question. Before they finish, you already know your answer and begin speaking.',
     'What is the FIRST signal?', 30, 1)
    returning id into q1;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q2',
     'You are in a conversation. The other person asks a question. Before they finish, you already know your answer and begin speaking.',
     'What stage of the system is occurring?', 30, 2)
    returning id into q2;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q3',
     'You are in a conversation. The other person asks a question. Before they finish, you already know your answer and begin speaking.',
     'What is the FIRST correct action?', 30, 3)
    returning id into q3;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q4',
     'You are in a conversation. The other person asks a question. Before they finish, you already know your answer and begin speaking.',
     'What must you avoid?', 30, 4)
    returning id into q4;

  -- Q1 options (correct: B — Response timing shortened)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q1, 'A', 'Emotional escalation',                                'Q2', 1),
    (q1, 'B', 'Response timing shortened',                           'Q2', 2),
    (q1, 'C', 'Conflict between participants',                       'Q2', 3),
    (q1, 'D', 'Recovery failure',                                    'Q2', 4);
  -- Q2 options (correct: C — Interaction velocity increase)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q2, 'A', 'Recovery drift',                                      'Q3', 1),
    (q2, 'B', 'Outcome collapse',                                    'Q3', 2),
    (q2, 'C', 'Interaction velocity increase',                       'Q3', 3),
    (q2, 'D', 'Full escalation',                                     'Q3', 4);
  -- Q3 options (correct: C — Slow response timing slightly)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q3, 'A', 'Correct the other person’s behavior',                 'Q4', 1),
    (q3, 'B', 'Match their pace',                                    'Q4', 2),
    (q3, 'C', 'Slow response timing slightly',                       'Q4', 3),
    (q3, 'D', 'End the conversation',                                'Q4', 4);
  -- Q4 options (correct: C — Matching speed and interruption patterns)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q4, 'A', 'Preserving the gap',                                  null, 1),
    (q4, 'B', 'Widening perception',                                 null, 2),
    (q4, 'C', 'Matching speed and interruption patterns',            null, 3),
    (q4, 'D', 'Reducing cadence',                                    null, 4);

  insert into assessments (code, name, kind, scenario_fk, is_active) values
    ('scenario_conversation_velocity_v1', 'Scenario 1 — Conversation Velocity', 'scenario', s_id, true);

  -- ============================================================
  -- SCENARIO 2 — Perception Narrowing
  -- ============================================================
  insert into scenarios (
    scenario_id, version, title, entry_screen_id, is_active,
    commitment_mode, domain, compression_level, ambiguity, emotional_load,
    sensory_complexity, authority_conflict, time_pressure, casualty_complexity,
    governance_challenge
  ) values (
    'perception_narrowing_v1', 'v1', 'Perception Narrowing', 'Q1', false,
    'revisable', 'leadership', 'moderate', 'high', 'moderate',
    'moderate', false, 'moderate', 'none', 'individual'
  ) returning id into s_id;

  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q1',
     'You are presented with a complex situation. One detail stands out immediately. You focus on it and stop asking questions.',
     'What is the FIRST signal?', 30, 1)
    returning id into q1;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q2',
     'You are presented with a complex situation. One detail stands out immediately. You focus on it and stop asking questions.',
     'What stage of the system is occurring?', 30, 2)
    returning id into q2;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q3',
     'You are presented with a complex situation. One detail stands out immediately. You focus on it and stop asking questions.',
     'What is the FIRST correct action?', 30, 3)
    returning id into q3;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q4',
     'You are presented with a complex situation. One detail stands out immediately. You focus on it and stop asking questions.',
     'What must you avoid?', 30, 4)
    returning id into q4;

  -- Q1 (correct: B — Scanning decreases)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q1, 'A', 'Visible conflict',                                    'Q2', 1),
    (q1, 'B', 'Scanning decreases',                                  'Q2', 2),
    (q1, 'C', 'Emotional escalation',                                'Q2', 3),
    (q1, 'D', 'Loss of posture',                                     'Q2', 4);
  -- Q2 (correct: B — Perception narrowing (CAC™ degradation))
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q2, 'A', 'Recovery failure',                                    'Q3', 1),
    (q2, 'B', 'Perception narrowing (CAC™ degradation)',             'Q3', 2),
    (q2, 'C', 'Behavior collapse',                                   'Q3', 3),
    (q2, 'D', 'Outcome fixation',                                    'Q3', 4);
  -- Q3 (correct: C — Ask one more question and widen the frame)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q3, 'A', 'Commit to the dominant cue',                          'Q4', 1),
    (q3, 'B', 'Challenge aggressively',                              'Q4', 2),
    (q3, 'C', 'Ask one more question and widen the frame',           'Q4', 3),
    (q3, 'D', 'Accelerate decisions',                                'Q4', 4);
  -- Q4 (correct: C — Treating certainty as accuracy)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q4, 'A', 'Introducing another variable',                        null, 1),
    (q4, 'B', 'Maintaining ambiguity',                               null, 2),
    (q4, 'C', 'Treating certainty as accuracy',                      null, 3),
    (q4, 'D', 'Delaying commitment',                                 null, 4);

  insert into assessments (code, name, kind, scenario_fk, is_active) values
    ('scenario_perception_narrowing_v1', 'Scenario 2 — Perception Narrowing', 'scenario', s_id, true);

  -- ============================================================
  -- SCENARIO 3 — Escalation Loop
  -- ============================================================
  insert into scenarios (
    scenario_id, version, title, entry_screen_id, is_active,
    commitment_mode, domain, compression_level, ambiguity, emotional_load,
    sensory_complexity, authority_conflict, time_pressure, casualty_complexity,
    governance_challenge
  ) values (
    'escalation_loop_v1', 'v1', 'Escalation Loop', 'Q1', false,
    'revisable', 'leadership', 'high', 'moderate', 'high',
    'moderate', null, 'high', 'none', 'individual'
  ) returning id into s_id;

  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q1',
     'A conversation speeds up slightly. You respond faster. The other person responds even faster. The pace continues to increase.',
     'What is the FIRST signal?', 30, 1)
    returning id into q1;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q2',
     'A conversation speeds up slightly. You respond faster. The other person responds even faster. The pace continues to increase.',
     'What stage of the system is occurring?', 30, 2)
    returning id into q2;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q3',
     'A conversation speeds up slightly. You respond faster. The other person responds even faster. The pace continues to increase.',
     'What is the FIRST correct action?', 30, 3)
    returning id into q3;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q4',
     'A conversation speeds up slightly. You respond faster. The other person responds even faster. The pace continues to increase.',
     'What must you avoid?', 30, 4)
    returning id into q4;

  -- Q1 (correct: B — Acceleration in response timing)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q1, 'A', 'Open argument',                                       'Q2', 1),
    (q1, 'B', 'Acceleration in response timing',                     'Q2', 2),
    (q1, 'C', 'Threat behavior',                                     'Q2', 3),
    (q1, 'D', 'Recovery drift',                                      'Q2', 4);
  -- Q2 (correct: B — Escalation loop formation)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q2, 'A', 'Full behavioral collapse',                            'Q3', 1),
    (q2, 'B', 'Escalation loop formation',                           'Q3', 2),
    (q2, 'C', 'Recovery stabilization',                              'Q3', 3),
    (q2, 'D', 'Post-event drift',                                    'Q3', 4);
  -- Q3 (correct: C — Insert space and lower cadence)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q3, 'A', 'Match intensity',                                     'Q4', 1),
    (q3, 'B', 'Correct content immediately',                         'Q4', 2),
    (q3, 'C', 'Insert space and lower cadence',                      'Q4', 3),
    (q3, 'D', 'End the interaction',                                 'Q4', 4);
  -- Q4 (correct: C — Matching speed and intensity)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q4, 'A', 'Preserving latency',                                  null, 1),
    (q4, 'B', 'Widening perception',                                 null, 2),
    (q4, 'C', 'Matching speed and intensity',                        null, 3),
    (q4, 'D', 'Breathing control',                                   null, 4);

  insert into assessments (code, name, kind, scenario_fk, is_active) values
    ('scenario_escalation_loop_v1', 'Scenario 3 — Escalation Loop', 'scenario', s_id, true);

  -- ============================================================
  -- SCENARIO 4 — Team Velocity
  -- ============================================================
  insert into scenarios (
    scenario_id, version, title, entry_screen_id, is_active,
    commitment_mode, domain, compression_level, ambiguity, emotional_load,
    sensory_complexity, authority_conflict, time_pressure, casualty_complexity,
    governance_challenge
  ) values (
    'team_velocity_v1', 'v1', 'Team Velocity', 'Q1', false,
    'revisable', 'leadership', 'high', 'moderate', 'moderate',
    'moderate', null, 'high', 'none', 'team'
  ) returning id into s_id;

  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q1',
     'You are with a team in a high-stakes situation. The group begins moving faster. Communication tightens. Decisions are being made earlier and earlier.',
     'What is the FIRST signal?', 30, 1)
    returning id into q1;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q2',
     'You are with a team in a high-stakes situation. The group begins moving faster. Communication tightens. Decisions are being made earlier and earlier.',
     'What stage of the system is occurring?', 30, 2)
    returning id into q2;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q3',
     'You are with a team in a high-stakes situation. The group begins moving faster. Communication tightens. Decisions are being made earlier and earlier.',
     'What is the FIRST correct action?', 30, 3)
    returning id into q3;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q4',
     'You are with a team in a high-stakes situation. The group begins moving faster. Communication tightens. Decisions are being made earlier and earlier.',
     'What must you avoid?', 30, 4)
    returning id into q4;

  -- Q1 (correct: B — Room pace increases)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q1, 'A', 'Coordination failure',                                'Q2', 1),
    (q1, 'B', 'Room pace increases',                                 'Q2', 2),
    (q1, 'C', 'Open confusion',                                      'Q2', 3),
    (q1, 'D', 'Policy breakdown',                                    'Q2', 4);
  -- Q2 (correct: C — Team velocity / system acceleration)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q2, 'A', 'Drift accumulation',                                  'Q3', 1),
    (q2, 'B', 'Recovery phase',                                      'Q3', 2),
    (q2, 'C', 'Team velocity / system acceleration',                 'Q3', 3),
    (q2, 'D', 'Outcome collapse',                                    'Q3', 4);
  -- Q3 (correct: B — Stabilize pacing and insert space)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q3, 'A', 'Increase urgency',                                    'Q4', 1),
    (q3, 'B', 'Stabilize pacing and insert space',                   'Q4', 2),
    (q3, 'C', 'Force rapid decisions',                               'Q4', 3),
    (q3, 'D', 'Isolate one speaker',                                 'Q4', 4);
  -- Q4 (correct: C — Matching group speed)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q4, 'A', 'Controlled cadence',                                  null, 1),
    (q4, 'B', 'Maintaining spacing',                                 null, 2),
    (q4, 'C', 'Matching group speed',                                null, 3),
    (q4, 'D', 'Widening latency',                                    null, 4);

  insert into assessments (code, name, kind, scenario_fk, is_active) values
    ('scenario_team_velocity_v1', 'Scenario 4 — Team Velocity', 'scenario', s_id, true);

  -- ============================================================
  -- SCENARIO 5 — Recovery Failure / Drift
  -- ============================================================
  insert into scenarios (
    scenario_id, version, title, entry_screen_id, is_active,
    commitment_mode, domain, compression_level, ambiguity, emotional_load,
    sensory_complexity, authority_conflict, time_pressure, casualty_complexity,
    governance_challenge
  ) values (
    'recovery_drift_v1', 'v1', 'Recovery Failure / Drift', 'Q1', false,
    'revisable', 'leadership', 'moderate', 'moderate', 'moderate',
    'low', null, 'moderate', 'none', 'individual'
  ) returning id into s_id;

  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q1',
     'You have just experienced a high-pressure event. You move directly into the next situation without resetting. Over time, your responses become faster, simpler, and less controlled.',
     'What is the FIRST signal?', 30, 1)
    returning id into q1;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q2',
     'You have just experienced a high-pressure event. You move directly into the next situation without resetting. Over time, your responses become faster, simpler, and less controlled.',
     'What stage of the system is occurring?', 30, 2)
    returning id into q2;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q3',
     'You have just experienced a high-pressure event. You move directly into the next situation without resetting. Over time, your responses become faster, simpler, and less controlled.',
     'What is the FIRST correct action?', 30, 3)
    returning id into q3;
  insert into scenario_screens (scenario_fk, screen_id, screen_text, screen_prompt, timer_seconds, sort_order)
  values
    (s_id, 'Q4',
     'You have just experienced a high-pressure event. You move directly into the next situation without resetting. Over time, your responses become faster, simpler, and less controlled.',
     'What must you avoid?', 30, 4)
    returning id into q4;

  -- Q1 (correct: B — Immediate transition without reset)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q1, 'A', 'Open emotional reaction',                             'Q2', 1),
    (q1, 'B', 'Immediate transition without reset',                  'Q2', 2),
    (q1, 'C', 'Behavioral collapse',                                 'Q2', 3),
    (q1, 'D', 'Conflict escalation',                                 'Q2', 4);
  -- Q2 (correct: B — CRA™ degradation / early drift)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q2, 'A', 'Perception expansion',                                'Q3', 1),
    (q2, 'B', 'CRA™ degradation / early drift',                      'Q3', 2),
    (q2, 'C', 'Outcome failure',                                     'Q3', 3),
    (q2, 'D', 'Environmental escalation',                            'Q3', 4);
  -- Q3 (correct: C — Pause, exhale, and reset)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q3, 'A', 'Push through the next task',                          'Q4', 1),
    (q3, 'B', 'Increase focus and speed',                            'Q4', 2),
    (q3, 'C', 'Pause, exhale, and reset',                            'Q4', 3),
    (q3, 'D', 'Ignore carryover',                                    'Q4', 4);
  -- Q4 (correct: C — Treating each moment as independent)
  insert into screen_options (screen_fk, option_label, option_text, next_screen_id, sort_order) values
    (q4, 'A', 'Reorienting before the next task',                    null, 1),
    (q4, 'B', 'Reducing tension',                                    null, 2),
    (q4, 'C', 'Treating each moment as independent',                 null, 3),
    (q4, 'D', 'Restoring baseline',                                  null, 4);

  insert into assessments (code, name, kind, scenario_fk, is_active) values
    ('scenario_recovery_drift_v1', 'Scenario 5 — Recovery Failure / Drift', 'scenario', s_id, true);

end$$;

-- ============================================================
-- Integrity check: every new scenario must have exactly 4 screens with
-- exactly 4 options each, and exactly one terminal options row per scenario.
-- (We don't check correctness here — that's the doctor's job via admin UI
-- and is_correct lives in mc_options, not screen_options. For scenario
-- assessments, correctness is tagged via response_tags or markers later.)
-- ============================================================
do $$
declare
  bad_count int;
begin
  select count(*) into bad_count
    from scenarios s
    left join lateral (
      select
        (select count(*) from scenario_screens where scenario_fk = s.id) as screen_count,
        (select count(*) from screen_options o
           join scenario_screens scr on scr.id = o.screen_fk
          where scr.scenario_fk = s.id) as option_count
    ) c on true
   where s.scenario_id in (
     'conversation_velocity_v1','perception_narrowing_v1','escalation_loop_v1',
     'team_velocity_v1','recovery_drift_v1'
   )
     and (c.screen_count <> 4 or c.option_count <> 16);
  if bad_count > 0 then
    raise exception 'scenario seed integrity check failed: % scenarios do not have 4 screens × 4 options', bad_count;
  end if;
end$$;

commit;
