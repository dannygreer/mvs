-- Seed: MVS Certification Exam — 50-Question Test Bank
-- Source: Test Bank Questions.docx + Exam Answer Key and Rubric.docx (delivered by Dr. Scully 2026-05-08)
-- Apply AFTER 0006_multi_choice_test.sql (which creates the assessment row + tables).
-- Idempotent: safe to re-run; uses on conflict for the questions and a clean sweep of options.
--
-- Caveats (logged in docs/needs_doctor.md):
--   - response_category remains NULL for all options. The rubric defines a pass/fail standard
--     and a four-tier performance band, but does not categorize per-option (e.g., outcome trap
--     vs. late detection vs. wrong stage). Day 9 admin polish can revisit if doctor delivers.
--   - Q29 still reads "The interact becomes reactive, system responsive" — likely a stray
--     find-replace artifact in the doctor's source. Preserved verbatim; flag for cleanup.
--   - Trademark insertions like "Cognitive Access Control™ (CAC™)" appear inline in some
--     question/option text per the doctor's source. Preserved verbatim.
--   - Answer distribution is heavily skewed: 41/50 = B (82%), 4 = A, 4 = C, 1 = D.
--     This is what the doctor delivered; flag with him whether intentional.

begin;

-- Make sure the parent assessment exists (created by 0006 migration).
do $$ begin
  if not exists (select 1 from assessments where code = 'mvs_test_bank_v1') then
    raise exception 'assessment mvs_test_bank_v1 missing — apply 0006_multi_choice_test.sql first';
  end if;
end$$;

-- Clean any prior stub or partial seed for this assessment.
delete from mc_options
 where question_id in (
   select id from mc_questions
    where assessment_id = (select id from assessments where code = 'mvs_test_bank_v1')
 );
delete from mc_questions
 where assessment_id = (select id from assessments where code = 'mvs_test_bank_v1');

-- Update the friendly name now that real content is loaded.
update assessments
   set name = 'MVS Certification Exam (50 Questions)'
 where code = 'mvs_test_bank_v1';

-- ============================================================
-- Pass 1: insert all 50 questions
-- ============================================================
insert into mc_questions (assessment_id, sequence, prompt, time_limit_seconds)
select (select id from assessments where code = 'mvs_test_bank_v1'), seq, prompt, 30
  from (values
    (1,  E'Nothing seems wrong, but you notice you''re already forming your response while the question is still being asked. What is the FIRST system change?'),
    (2,  E'You feel increasing certainty early and notice you are no longer asking questions, even though information is still developing. What is the FIRST occurring?'),
    (3,  E'Your response begins forming before the moment fully completes, and you deliver it without pause. What has been lost?'),
    (4,  E'One detail stands out strongly and you begin organizing your response around it while other information fades from awareness. What is the FIRST reduced?'),
    (5,  E'You carry tension into the next situation. What failed?'),
    (6,  E'You begin speaking while the other person is still talking, based on what you think they are going to say. What is the FIRST issue?'),
    (7,  E'You feel urgency and act immediately. What should you question first?'),
    (8,  E'The system speeds up and perception, Cognitive Access Control™ (CAC™) narrows. What happens next?'),
    (9,  E'You act before full information is available. What failed?'),
    (10, E'You miss key information but feel confident. What is the FIRST occurring?'),
    (11, E'You respond faster than the situation requires. What changed first?'),
    (12, E'You stop adjusting when new info appears. What stage?'),
    (13, E'You rush after a mistake. What failed?'),
    (14, E'You act to relieve pressure. What is the FIRST driving the behavior?'),
    (15, E'You simplify a situation too quickly. What dropped?'),
    (16, E'Another person speeds up. You match them. What occurred?'),
    (17, E'Both sides begin interrupting each other. What is the FIRST forming?'),
    (18, E'You respond before fully understanding. What broke?'),
    (19, E'The conversation tightens and speeds up. What is the FIRST signal?'),
    (20, E'Someone becomes fixed and stops adjusting. What is the FIRST happening?'),
    (21, E'You match intensity during interaction. What does this cause?'),
    (22, E'You interrupt to stay engaged. What did you lose?'),
    (23, E'The interaction speeds up across both people. What is the FIRST driving it?'),
    (24, E'You respond to part of a statement. What failed?'),
    (25, E'You push harder when someone resists. What happens?'),
    (26, E'You maintain your pace while others accelerate. What are you doing?'),
    (27, E'You allow silence before responding. What are you preserving?'),
    (28, E'You reintroduce information calmly. What are you doing?'),
    (29, E'The interact becomes reactive, system responsive. What is the FIRST missing?'),
    (30, E'You resist matching speed. What are you controlling?'),
    (31, E'A room begins to speed up. What is this FIRST?'),
    (32, E'Multiple people begin responding quickly. What changed?'),
    (33, E'You enter calm and the room slows. What occurred?'),
    (34, E'You rush a decision and others follow. What did you affect?'),
    (35, E'A decision forces early act in others. What failed?'),
    (36, E'The system speeds up across a group. What is the FIRST happening?'),
    (37, E'You slow your pace and others adjust. What is this FIRST?'),
    (38, E'You act before others are ready. What is the FIRST affected?'),
    (39, E'You maintain timing, Cognitive Latency Preservation™ (CLP™) under pressure. What are you preserving?'),
    (40, E'You introduce urgency into a group. What spreads?'),
    (41, E'You stabilize your state first. What improves?'),
    (42, E'The group becomes reactive. What was lost?'),
    (43, E'You delay a decision appropriately. What did you preserve?'),
    (44, E'Others adjust to your behavior. What is this FIRST?'),
    (45, E'You prevent escalation by slowing pace. What did you remove?'),
    (46, E'Performance declines gradually over time. What is the FIRST occurring?'),
    (47, E'You don''t reset between tasks. What happens?'),
    (48, E'Your baseline changes without noticing. What is this FIRST?'),
    (49, E'You restore baseline before continuing. What are you doing?'),
    (50, E'You recognize change early and reset. What does this prevent?')
  ) as q(seq, prompt);

-- ============================================================
-- Pass 2: insert all 200 options with correctness from the doctor's answer key
-- Answer key: Section I (1–15)  B B B B B A B C C B B B A B B
--             Section II (16–30) B B A B B B A B B B B B B B B
--             Section III (31–45) all B
--             Section IV (46–50)  B B B D B
-- ============================================================
insert into mc_options (question_id, label, text, is_correct)
select q.id, opt.label, opt.text, opt.is_correct
  from mc_questions q
  join (values
    -- ===== SECTION I — CORE SYSTEM RECOGNITION (1–15) =====
    (1,  'A', 'Bandwidth loss',                                              false),
    (1,  'B', 'Velocity increase',                                           true),
    (1,  'C', 'Recovery failure',                                            false),
    (1,  'D', 'Drift',                                                       false),

    (2,  'A', 'Latency expansion',                                           false),
    (2,  'B', 'Perception narrowing',                                        true),
    (2,  'C', 'Recovery',                                                    false),
    (2,  'D', 'Alignment',                                                   false),

    (3,  'A', 'Bandwidth',                                                   false),
    (3,  'B', 'Gap',                                                         true),
    (3,  'C', 'Recovery',                                                    false),
    (3,  'D', 'Drift',                                                       false),

    (4,  'A', 'Latency',                                                     false),
    (4,  'B', 'Bandwidth',                                                   true),
    (4,  'C', 'Recovery',                                                    false),
    (4,  'D', 'Tempo',                                                       false),

    (5,  'A', 'Perception',                                                  false),
    (5,  'B', 'Recovery',                                                    true),
    (5,  'C', 'Velocity',                                                    false),
    (5,  'D', 'Sequencing',                                                  false),

    (6,  'A', 'Sequencing breakdown',                                        true),
    (6,  'B', 'Drift',                                                       false),
    (6,  'C', 'Recovery',                                                    false),
    (6,  'D', 'Alignment',                                                   false),

    (7,  'A', 'Outcome',                                                     false),
    (7,  'B', 'Timing',                                                      true),
    (7,  'C', 'Confidence',                                                  false),
    (7,  'D', 'Effort',                                                      false),

    (8,  'A', 'Recovery',                                                    false),
    (8,  'B', 'Bandwidth increase',                                          false),
    (8,  'C', 'Latency compression',                                         true),
    (8,  'D', 'Stability',                                                   false),

    (9,  'A', 'Bandwidth',                                                   false),
    (9,  'B', 'Sequencing',                                                  false),
    (9,  'C', 'Timing',                                                      true),
    (9,  'D', 'Recovery',                                                    false),

    (10, 'A', 'Increased clarity',                                           false),
    (10, 'B', 'Perception narrowing',                                        true),
    (10, 'C', 'Recovery',                                                    false),
    (10, 'D', 'Alignment',                                                   false),

    (11, 'A', 'Perception',                                                  false),
    (11, 'B', 'Velocity',                                                    true),
    (11, 'C', 'Recovery',                                                    false),
    (11, 'D', 'Drift',                                                       false),

    (12, 'A', 'Recovery',                                                    false),
    (12, 'B', 'Narrowed perception — Cognitive Access Control™ (CAC™)',      true),
    (12, 'C', 'Latency',                                                     false),
    (12, 'D', 'Drift',                                                       false),

    (13, 'A', 'Recovery',                                                    true),
    (13, 'B', 'Sequencing',                                                  false),
    (13, 'C', 'Bandwidth',                                                   false),
    (13, 'D', 'Tempo',                                                       false),

    (14, 'A', 'Accuracy',                                                    false),
    (14, 'B', 'Urgency',                                                     true),
    (14, 'C', 'Clarity',                                                     false),
    (14, 'D', 'Alignment',                                                   false),

    (15, 'A', 'Timing',                                                      false),
    (15, 'B', 'Variables',                                                   true),
    (15, 'C', 'Effort',                                                      false),
    (15, 'D', 'Control',                                                     false),

    -- ===== SECTION II — INTERACTION (16–30) =====
    (16, 'A', 'Recovery',                                                    false),
    (16, 'B', 'Interaction velocity transfer',                               true),
    (16, 'C', 'Drift',                                                       false),
    (16, 'D', 'Alignment',                                                   false),

    (17, 'A', 'Drift',                                                       false),
    (17, 'B', 'Escalation loop',                                             true),
    (17, 'C', 'Recovery',                                                    false),
    (17, 'D', 'Stability',                                                   false),

    (18, 'A', 'Sequencing',                                                  true),
    (18, 'B', 'Recovery',                                                    false),
    (18, 'C', 'Bandwidth',                                                   false),
    (18, 'D', 'Tempo',                                                       false),

    (19, 'A', 'Conflict',                                                    false),
    (19, 'B', 'Acceleration',                                                true),
    (19, 'C', 'Miscommunication',                                            false),
    (19, 'D', 'Emotion',                                                     false),

    (20, 'A', 'Intentional resistance',                                      false),
    (20, 'B', 'Narrowed perception — Cognitive Access Control™ (CAC™)',      true),
    (20, 'C', 'Recovery',                                                    false),
    (20, 'D', 'Alignment',                                                   false),

    (21, 'A', 'Stabilization',                                               false),
    (21, 'B', 'Escalation',                                                  true),
    (21, 'C', 'Recovery',                                                    false),
    (21, 'D', 'Alignment',                                                   false),

    (22, 'A', 'Timing',                                                      true),
    (22, 'B', 'Confidence',                                                  false),
    (22, 'C', 'Awareness',                                                   false),
    (22, 'D', 'Control',                                                     false),

    (23, 'A', 'Content',                                                     false),
    (23, 'B', 'Shared velocity',                                             true),
    (23, 'C', 'Emotion',                                                     false),
    (23, 'D', 'Misunderstanding',                                            false),

    (24, 'A', 'Recovery',                                                    false),
    (24, 'B', 'Sequencing',                                                  true),
    (24, 'C', 'Drift',                                                       false),
    (24, 'D', 'Tempo',                                                       false),

    (25, 'A', 'Perception expands',                                          false),
    (25, 'B', 'Perception narrows further',                                  true),
    (25, 'C', 'Recovery improves',                                           false),
    (25, 'D', 'Stability increases',                                         false),

    (26, 'A', 'Disengaging',                                                 false),
    (26, 'B', 'Stabilizing interaction',                                     true),
    (26, 'C', 'Slowing progress',                                            false),
    (26, 'D', 'Avoiding conflict',                                           false),

    (27, 'A', 'Bandwidth',                                                   false),
    (27, 'B', 'Gap',                                                         true),
    (27, 'C', 'Recovery',                                                    false),
    (27, 'D', 'Drift',                                                       false),

    (28, 'A', 'Challenging',                                                 false),
    (28, 'B', 'Expanding perception, Cognitive Access Control™ (CAC™)',      true),
    (28, 'C', 'Accelerating',                                                false),
    (28, 'D', 'Avoiding',                                                    false),

    (29, 'A', 'Effort',                                                      false),
    (29, 'B', 'Structure',                                                   true),
    (29, 'C', 'Confidence',                                                  false),
    (29, 'D', 'Volume',                                                      false),

    (30, 'A', 'Outcome',                                                     false),
    (30, 'B', 'Tempo',                                                       true),
    (30, 'C', 'Emotion',                                                     false),
    (30, 'D', 'Behavior',                                                    false),

    -- ===== SECTION III — SYSTEM LEVEL (31–45) =====
    (31, 'A', 'Conflict',                                                    false),
    (31, 'B', 'Room velocity',                                               true),
    (31, 'C', 'Drift',                                                       false),
    (31, 'D', 'Recovery',                                                    false),

    (32, 'A', 'Individuals',                                                 false),
    (32, 'B', 'Environment',                                                 true),
    (32, 'C', 'Content',                                                     false),
    (32, 'D', 'Structure',                                                   false),

    (33, 'A', 'Control',                                                     false),
    (33, 'B', 'State propagation',                                           true),
    (33, 'C', 'Recovery',                                                    false),
    (33, 'D', 'Drift',                                                       false),

    (34, 'A', 'Emotion',                                                     false),
    (34, 'B', 'System timing, Cognitive Latency Preservation™ (CLP™)',       true),
    (34, 'C', 'Behavior',                                                    false),
    (34, 'D', 'Structure',                                                   false),

    (35, 'A', 'Authority',                                                   false),
    (35, 'B', 'Timing',                                                      true),
    (35, 'C', 'Confidence',                                                  false),
    (35, 'D', 'Alignment',                                                   false),

    (36, 'A', 'Individual error',                                            false),
    (36, 'B', 'System acceleration',                                         true),
    (36, 'C', 'Miscommunication',                                            false),
    (36, 'D', 'Conflict',                                                    false),

    (37, 'A', 'Control',                                                     false),
    (37, 'B', 'Influence',                                                   true),
    (37, 'C', 'Recovery',                                                    false),
    (37, 'D', 'Drift',                                                       false),

    (38, 'A', 'Outcome',                                                     false),
    (38, 'B', 'Coordination',                                                true),
    (38, 'C', 'Confidence',                                                  false),
    (38, 'D', 'Behavior',                                                    false),

    (39, 'A', 'Authority',                                                   false),
    (39, 'B', 'Sequence',                                                    true),
    (39, 'C', 'Speed',                                                       false),
    (39, 'D', 'Outcome',                                                     false),

    (40, 'A', 'Emotion',                                                     false),
    (40, 'B', 'Speed',                                                       true),
    (40, 'C', 'Control',                                                     false),
    (40, 'D', 'Logic',                                                       false),

    (41, 'A', 'Outcome',                                                     false),
    (41, 'B', 'Influence',                                                   true),
    (41, 'C', 'Effort',                                                      false),
    (41, 'D', 'Speed',                                                       false),

    (42, 'A', 'Effort',                                                      false),
    (42, 'B', 'Structure',                                                   true),
    (42, 'C', 'Confidence',                                                  false),
    (42, 'D', 'Energy',                                                      false),

    (43, 'A', 'Speed',                                                       false),
    (43, 'B', 'Timing',                                                      true),
    (43, 'C', 'Authority',                                                   false),
    (43, 'D', 'Control',                                                     false),

    (44, 'A', 'React',                                                       false),
    (44, 'B', 'Synchronization',                                             true),
    (44, 'C', 'Conflict',                                                    false),
    (44, 'D', 'Resistance',                                                  false),

    (45, 'A', 'Emotion',                                                     false),
    (45, 'B', 'Speed',                                                       true),
    (45, 'C', 'Conflict',                                                    false),
    (45, 'D', 'Pressure',                                                    false),

    -- ===== SECTION IV — DRIFT & RECOVERY (46–50) =====
    (46, 'A', 'Fatigue',                                                     false),
    (46, 'B', 'Drift',                                                       true),
    (46, 'C', 'Recovery',                                                    false),
    (46, 'D', 'Alignment',                                                   false),

    (47, 'A', 'Stability increases',                                         false),
    (47, 'B', 'Accumulation occurs',                                         true),
    (47, 'C', 'Timing improves',                                             false),
    (47, 'D', 'Clarity improves',                                            false),

    (48, 'A', 'Recovery',                                                    false),
    (48, 'B', 'Drift',                                                       true),
    (48, 'C', 'Adaptation',                                                  false),
    (48, 'D', 'Awareness',                                                   false),

    (49, 'A', 'Avoiding',                                                    false),
    (49, 'B', 'Recovering',                                                  false),
    (49, 'C', 'Slowing',                                                     false),
    (49, 'D', 'Resetting system',                                            true),

    (50, 'A', 'Conflict',                                                    false),
    (50, 'B', 'Accumulation',                                                true),
    (50, 'C', 'Effort',                                                      false),
    (50, 'D', 'Pressure',                                                    false)
  ) as opt(seq, label, text, is_correct)
    on opt.seq = q.sequence
 where q.assessment_id = (select id from assessments where code = 'mvs_test_bank_v1');

-- Sanity check: every question should have exactly 4 options and exactly 1 correct.
do $$
declare
  bad_count int;
begin
  select count(*) into bad_count
    from mc_questions q
    left join lateral (
      select count(*) filter (where is_correct) as c, count(*) as t
        from mc_options o where o.question_id = q.id
    ) o on true
   where q.assessment_id = (select id from assessments where code = 'mvs_test_bank_v1')
     and (o.t <> 4 or o.c <> 1);

  if bad_count > 0 then
    raise exception 'Seed integrity check failed: % questions do not have exactly 4 options with exactly 1 correct', bad_count;
  end if;
end$$;

commit;
