-- 0012_phase1_freeze.sql
-- Phase 1 Architecture Freeze per docs/phase1_freeze.md (locked by Dr. Scully 2026-05-10).
--
-- Additive only. No existing data is modified except for sensible defaults and
-- the backfill of active_threat_v1 classification tags. Three pillars:
--   1. 9 classification tags + commitment_mode on scenarios
--   2. Per-option triggers_markers JSONB on screen_options + mc_options
--   3. responses_long event_markers / presented_options / is_revision /
--      revises_response_event_id / revision_number; responses_wide outcome_state
--
-- Migration 0008 added a partial unique index on
-- responses_long (enrollment_id, question_id). That blocks the revisable
-- mode (a question now produces multiple event rows on revision). We extend
-- the unique key to include revision_number so race-losers still collide
-- (both submit revision_number=0) while legitimate revisions are allowed.

-- ============================================================
-- 1. SCENARIO CLASSIFICATION TAGS + COMMITMENT MODE
-- ============================================================
alter table scenarios
  add column if not exists commitment_mode text not null default 'locked'
    check (commitment_mode in ('locked','revisable')),
  add column if not exists domain text
    check (domain in ('tactical','medical','leadership','executive') or domain is null),
  add column if not exists compression_level text
    check (compression_level in ('low','moderate','high','extreme') or compression_level is null),
  add column if not exists ambiguity text
    check (ambiguity in ('low','moderate','high') or ambiguity is null),
  add column if not exists emotional_load text
    check (emotional_load in ('low','moderate','high') or emotional_load is null),
  add column if not exists sensory_complexity text
    check (sensory_complexity in ('low','moderate','high') or sensory_complexity is null),
  add column if not exists authority_conflict boolean,
  add column if not exists time_pressure text
    check (time_pressure in ('low','moderate','high') or time_pressure is null),
  add column if not exists casualty_complexity text
    check (casualty_complexity in ('none','single','multiple','mass') or casualty_complexity is null),
  add column if not exists governance_challenge text
    check (governance_challenge in ('individual','team','organizational') or governance_challenge is null);

-- Backfill: active_threat_v1 -> tactical / extreme / locked per doctrine docs.
update scenarios set
  commitment_mode = 'locked',
  domain = 'tactical',
  compression_level = 'extreme',
  ambiguity = 'moderate',
  emotional_load = 'high',
  sensory_complexity = 'high',
  authority_conflict = false,
  time_pressure = 'high',
  casualty_complexity = 'mass',
  governance_challenge = 'individual'
 where scenario_id = 'active_threat_v1';

-- ============================================================
-- 2. PER-OPTION MARKER TAGGING
-- One JSONB column per option table; keys are the 8 locked markers,
-- values are booleans. Default empty object = no markers fire.
-- ============================================================
alter table screen_options
  add column if not exists triggers_markers jsonb not null default '{}'::jsonb;

alter table mc_options
  add column if not exists triggers_markers jsonb not null default '{}'::jsonb;

-- Expression indexes for the 8 known marker keys (fast cohort queries).
-- screen_options
create index if not exists screen_options_marker_escalation_idx
  on screen_options ((triggers_markers ->> 'escalation'))
  where triggers_markers ->> 'escalation' = 'true';
create index if not exists screen_options_marker_narrowing_idx
  on screen_options ((triggers_markers ->> 'narrowing'))
  where triggers_markers ->> 'narrowing' = 'true';
create index if not exists screen_options_marker_premature_commitment_idx
  on screen_options ((triggers_markers ->> 'premature_commitment'))
  where triggers_markers ->> 'premature_commitment' = 'true';
create index if not exists screen_options_marker_sequencing_break_idx
  on screen_options ((triggers_markers ->> 'sequencing_break'))
  where triggers_markers ->> 'sequencing_break' = 'true';
create index if not exists screen_options_marker_drift_idx
  on screen_options ((triggers_markers ->> 'drift'))
  where triggers_markers ->> 'drift' = 'true';
create index if not exists screen_options_marker_intervention_idx
  on screen_options ((triggers_markers ->> 'intervention'))
  where triggers_markers ->> 'intervention' = 'true';
create index if not exists screen_options_marker_recovery_idx
  on screen_options ((triggers_markers ->> 'recovery'))
  where triggers_markers ->> 'recovery' = 'true';
create index if not exists screen_options_marker_governance_instability_idx
  on screen_options ((triggers_markers ->> 'governance_instability'))
  where triggers_markers ->> 'governance_instability' = 'true';

-- mc_options
create index if not exists mc_options_marker_escalation_idx
  on mc_options ((triggers_markers ->> 'escalation'))
  where triggers_markers ->> 'escalation' = 'true';
create index if not exists mc_options_marker_narrowing_idx
  on mc_options ((triggers_markers ->> 'narrowing'))
  where triggers_markers ->> 'narrowing' = 'true';
create index if not exists mc_options_marker_premature_commitment_idx
  on mc_options ((triggers_markers ->> 'premature_commitment'))
  where triggers_markers ->> 'premature_commitment' = 'true';
create index if not exists mc_options_marker_sequencing_break_idx
  on mc_options ((triggers_markers ->> 'sequencing_break'))
  where triggers_markers ->> 'sequencing_break' = 'true';
create index if not exists mc_options_marker_drift_idx
  on mc_options ((triggers_markers ->> 'drift'))
  where triggers_markers ->> 'drift' = 'true';
create index if not exists mc_options_marker_intervention_idx
  on mc_options ((triggers_markers ->> 'intervention'))
  where triggers_markers ->> 'intervention' = 'true';
create index if not exists mc_options_marker_recovery_idx
  on mc_options ((triggers_markers ->> 'recovery'))
  where triggers_markers ->> 'recovery' = 'true';
create index if not exists mc_options_marker_governance_instability_idx
  on mc_options ((triggers_markers ->> 'governance_instability'))
  where triggers_markers ->> 'governance_instability' = 'true';

-- ============================================================
-- 3. RESPONSES_LONG — markers, revisions, presented_options
-- ============================================================
alter table responses_long
  add column if not exists event_markers jsonb not null default '{}'::jsonb,
  add column if not exists presented_options jsonb,
  add column if not exists is_revision boolean not null default false,
  add column if not exists revises_response_event_id bigint references responses_long(id) on delete set null,
  add column if not exists revision_number integer not null default 0;

-- Expression indexes for marker queries on events
create index if not exists responses_long_marker_escalation_idx
  on responses_long ((event_markers ->> 'escalation'))
  where event_markers ->> 'escalation' = 'true';
create index if not exists responses_long_marker_narrowing_idx
  on responses_long ((event_markers ->> 'narrowing'))
  where event_markers ->> 'narrowing' = 'true';
create index if not exists responses_long_marker_premature_commitment_idx
  on responses_long ((event_markers ->> 'premature_commitment'))
  where event_markers ->> 'premature_commitment' = 'true';
create index if not exists responses_long_marker_sequencing_break_idx
  on responses_long ((event_markers ->> 'sequencing_break'))
  where event_markers ->> 'sequencing_break' = 'true';
create index if not exists responses_long_marker_drift_idx
  on responses_long ((event_markers ->> 'drift'))
  where event_markers ->> 'drift' = 'true';
create index if not exists responses_long_marker_intervention_idx
  on responses_long ((event_markers ->> 'intervention'))
  where event_markers ->> 'intervention' = 'true';
create index if not exists responses_long_marker_recovery_idx
  on responses_long ((event_markers ->> 'recovery'))
  where event_markers ->> 'recovery' = 'true';
create index if not exists responses_long_marker_governance_instability_idx
  on responses_long ((event_markers ->> 'governance_instability'))
  where event_markers ->> 'governance_instability' = 'true';

-- Composite for "all revisions on this enrollment, anchored to the original event"
create index if not exists responses_long_revisions_idx
  on responses_long (enrollment_id, revises_response_event_id)
  where is_revision;

-- ============================================================
-- 4. RESPONSES_LONG — extend partial unique index to allow revisions
-- Original (0008): unique (enrollment_id, question_id) where enrollment_id is not null
-- New:             unique (enrollment_id, question_id, revision_number) where enrollment_id is not null
-- Race-losers always submit revision_number=0 -> still collide.
-- Legitimate revisions submit revision_number=1,2,... -> allowed.
-- ============================================================
drop index if exists responses_long_enrollment_question_uniq;
create unique index responses_long_enrollment_question_revision_uniq
  on responses_long (enrollment_id, question_id, revision_number)
  where enrollment_id is not null;

-- ============================================================
-- 5. RESPONSES_WIDE — outcome_state at session level
-- Terminal-screen ID for scenarios; null for multi-choice.
-- ============================================================
alter table responses_wide
  add column if not exists outcome_state text;

-- ============================================================
-- 6. RLS
-- All new columns inherit existing row-level policies — markers, tags,
-- revisions live on the same row sensitivity as the rows that hold them,
-- so column-level RLS is not needed. The 0003/0005 super_admin and
-- student-self policies still apply unchanged. RLS test suite verifies.
-- ============================================================
