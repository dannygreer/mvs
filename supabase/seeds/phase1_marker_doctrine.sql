-- phase1_marker_doctrine.sql
-- Phase A seed: integer marker weights + option_classification +
-- rationale for the 5 screens Scully's "Phase 1 Marker Assignment
-- Doctrine" specifies. Idempotent (plain UPDATEs keyed by
-- scenario_id + screen_id + option_label).
--
-- Doctrine covers ONLY: S1_START, A2_CONFIRM_1, B2_HIDE_1,
-- S5_CONVERGENCE, S6_FINAL_PRESSURE. The other ~10 screens stay
-- unweighted ({}), pending doctrine from Scully (flagged in plan).
--
-- recovery is NEGATIVE = stabilizing. Markers not listed for an
-- option are absent (= 0 via marker_weight()).

do $$
declare
  v_scenario_fk uuid;
begin
  select id into v_scenario_fk from scenarios
   where scenario_id = 'active_threat_v1'
   order by version desc limit 1;
  if v_scenario_fk is null then
    raise notice 'active_threat_v1 not found; nothing seeded.';
    return;
  end if;

  -- helper: update one option by (screen_id, option_label)
  -- inlined as repeated UPDATEs for clarity / auditability.

  -- ===== S1_START =====
  update screen_options o set
    triggers_markers = '{"drift":2,"governance_instability":1}'::jsonb,
    option_classification = 'Drift / Delayed Commitment',
    rationale = 'Delayed closure and prolonged uncertainty cycling.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S1_START' and o.option_label = 'A';

  update screen_options o set
    triggers_markers = '{"escalation":1,"recovery":-1}'::jsonb,
    option_classification = 'Controlled / Stabilizing',
    rationale = 'Governed stabilization behavior under uncertainty.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S1_START' and o.option_label = 'B';

  update screen_options o set
    triggers_markers = '{"escalation":3,"premature_commitment":3,"narrowing":2,"governance_instability":1}'::jsonb,
    option_classification = 'Premature Commitment / Acceleration',
    rationale = 'Accelerated commitment with reduced reassessment.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S1_START' and o.option_label = 'C';

  update screen_options o set
    triggers_markers = '{"sequencing_break":2,"governance_instability":2,"drift":1}'::jsonb,
    option_classification = 'Sequencing Instability',
    rationale = 'Communication before environmental stabilization.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S1_START' and o.option_label = 'D';

  -- ===== A2_CONFIRM_1 =====
  update screen_options o set
    triggers_markers = '{"drift":3,"governance_instability":2}'::jsonb,
    option_classification = 'Drift / Delayed Commitment',
    rationale = 'Entrenched uncertainty looping.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'A2_CONFIRM_1' and o.option_label = 'A';

  update screen_options o set
    triggers_markers = '{"escalation":2,"narrowing":1,"governance_instability":2,"premature_commitment":1}'::jsonb,
    option_classification = 'Premature Commitment / Acceleration',
    rationale = 'Exploratory escalation toward unresolved danger.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'A2_CONFIRM_1' and o.option_label = 'B';

  update screen_options o set
    triggers_markers = '{"escalation":1,"recovery":-2}'::jsonb,
    option_classification = 'Controlled / Stabilizing',
    rationale = 'Adaptive transition into stabilization.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'A2_CONFIRM_1' and o.option_label = 'C';

  update screen_options o set
    triggers_markers = '{"sequencing_break":2,"governance_instability":2,"drift":1}'::jsonb,
    option_classification = 'Sequencing Instability',
    rationale = 'Communication-first sequencing.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'A2_CONFIRM_1' and o.option_label = 'D';

  -- ===== B2_HIDE_1 =====
  update screen_options o set
    triggers_markers = '{"recovery":-2}'::jsonb,
    option_classification = 'Controlled / Stabilizing',
    rationale = 'Structured stabilization reinforcement.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'B2_HIDE_1' and o.option_label = 'A';

  update screen_options o set
    triggers_markers = '{"drift":2,"governance_instability":1,"narrowing":1}'::jsonb,
    option_classification = 'Drift / Delayed Commitment',
    rationale = 'Passive stabilization drift.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'B2_HIDE_1' and o.option_label = 'B';

  update screen_options o set
    triggers_markers = '{"governance_instability":1,"recovery":-1}'::jsonb,
    option_classification = 'Acceptable / Neutral',
    rationale = 'Communication after stabilization.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'B2_HIDE_1' and o.option_label = 'C';

  update screen_options o set
    triggers_markers = '{"escalation":2,"governance_instability":2,"premature_commitment":1,"sequencing_break":1}'::jsonb,
    option_classification = 'Governance Instability',
    rationale = 'Destabilized repositioning.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'B2_HIDE_1' and o.option_label = 'D';

  -- ===== S5_CONVERGENCE =====
  update screen_options o set
    triggers_markers = '{"recovery":-2,"narrowing":1}'::jsonb,
    option_classification = 'Controlled / Stabilizing',
    rationale = 'Maintains concealment.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S5_CONVERGENCE' and o.option_label = 'A';

  update screen_options o set
    triggers_markers = '{"escalation":3,"premature_commitment":2,"governance_instability":2}'::jsonb,
    option_classification = 'Premature Commitment / Acceleration',
    rationale = 'High-risk acceleration under convergence load.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S5_CONVERGENCE' and o.option_label = 'B';

  update screen_options o set
    triggers_markers = '{"governance_instability":1,"recovery":-1}'::jsonb,
    option_classification = 'Acceptable / Neutral',
    rationale = 'Communication after stabilization.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S5_CONVERGENCE' and o.option_label = 'C';

  update screen_options o set
    triggers_markers = '{"recovery":-2,"escalation":1}'::jsonb,
    option_classification = 'Controlled / Stabilizing',
    rationale = 'Conditional defensive readiness.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S5_CONVERGENCE' and o.option_label = 'D';

  -- ===== S6_FINAL_PRESSURE =====
  update screen_options o set
    triggers_markers = '{"drift":1,"narrowing":2,"recovery":-1}'::jsonb,
    option_classification = 'Drift / Delayed Commitment',
    rationale = 'Possible passive fixation under terminal pressure.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S6_FINAL_PRESSURE' and o.option_label = 'A';

  update screen_options o set
    triggers_markers = '{"escalation":3,"premature_commitment":3,"governance_instability":2}'::jsonb,
    option_classification = 'Premature Commitment / Acceleration',
    rationale = 'Compressed flight response.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S6_FINAL_PRESSURE' and o.option_label = 'B';

  update screen_options o set
    triggers_markers = '{"recovery":-3}'::jsonb,
    option_classification = 'Controlled / Stabilizing',
    rationale = 'Strong stabilization and environmental control.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S6_FINAL_PRESSURE' and o.option_label = 'C';

  update screen_options o set
    triggers_markers = '{"escalation":1,"recovery":-2}'::jsonb,
    option_classification = 'Controlled / Stabilizing',
    rationale = 'Governed conditional defensive posture.'
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = 'S6_FINAL_PRESSURE' and o.option_label = 'D';

  -- ===== Remaining 10 nodes (Missing Node Marker Completion Matrix) =====
  -- Scully's matrix applies one uniform A/B/C/D template to all 10
  -- nodes. Recovery is SIGN-FLIPPED here vs his doc: the original
  -- Marker Assignment Doctrine treats negative recovery as
  -- stabilizing; his matrix used positive-for-good. We negate his
  -- recovery so all 15 screens share one convention and
  -- net_governance_load stays coherent. (Flag to Scully: his two
  -- docs disagree on recovery's sign; we assumed negative=stabilizing.)
  --   A: recovery +1 -> -1   B: 0 (omitted)
  --   C: recovery -1 -> +1   D: recovery +1 -> -1
  update screen_options o set
    triggers_markers = case o.option_label
      when 'A' then '{"escalation":1,"narrowing":1,"premature_commitment":1,"sequencing_break":1,"intervention":2,"recovery":-1,"governance_instability":1}'::jsonb
      when 'B' then '{"escalation":1,"narrowing":2,"premature_commitment":1,"sequencing_break":1,"drift":1,"intervention":1,"governance_instability":1}'::jsonb
      when 'C' then '{"escalation":3,"narrowing":3,"premature_commitment":3,"sequencing_break":3,"drift":2,"recovery":1,"governance_instability":3}'::jsonb
      when 'D' then '{"escalation":1,"narrowing":1,"sequencing_break":1,"intervention":1,"recovery":-1,"governance_instability":1}'::jsonb
    end,
    option_classification = case o.option_label
      when 'A' then 'Controlled / Adaptive'
      when 'B' then 'Acceptable / Neutral'
      when 'C' then 'Unsafe / High Risk'
      when 'D' then 'Controlled but Passive'
    end,
    rationale = case o.option_label
      when 'A' then 'Maintains partial sequencing and preserves ambiguity tolerance.'
      when 'B' then 'Protective movement present, but narrowing and uncertainty compression increasing.'
      when 'C' then 'Strong acceleration and premature commitment pattern under uncertainty.'
      when 'D' then 'Reduced impulsive movement, but may externalize control or delay adaptive action.'
    end
  from scenario_screens s
  where o.screen_fk = s.id and s.scenario_fk = v_scenario_fk
    and s.screen_id = any(array[
      'C2_RUN_1','D2_CALL_1',
      'A3_CONFIRM_2','B3_HIDE_2','C3_RUN_2','D3_CALL_2',
      'A4_CONFIRM_3','B4_HIDE_3','C4_RUN_3','D4_CALL_3'
    ]);
end $$;
