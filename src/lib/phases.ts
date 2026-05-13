// Phase mapping for the /mvs/admin UI restructure.
//
// Doctrine (per Dr. Scully, session-day flow):
//   Phase 1 — Baseline Operational Assessment: active_threat at pre.
//   Phase 2 — Adaptive Performance Analysis:    active_threat at post.
//   Phase 3 — Operational Governance Cert:      50-Q MC + 5 video scenarios.
//
// This file is the single source of truth tying assessment.code values to
// a phase lens. If a new assessment is added later, append it here. When
// the doctor finally wants assessments routed across multiple phases
// (current model is one-phase-per-assessment), promote this to a
// per-assessment `phase_group` column on the assessments table.

export type PhaseId = 'phase_1' | 'phase_2' | 'phase_3';

export interface PhaseMeta {
  label: string;
  shortLabel: string;
  // Just the doctrine name, no "Phase N —" prefix. Used by phase pages to
  // render `${shortLabel}: ${name}` as the main H2.
  name: string;
  // Which enrollments.phase value this lens reads. Drives the analytics
  // queries (pre vs post completion stats, etc.).
  enrollmentPhase: 'pre' | 'post';
  // assessments.code values that belong to this phase.
  assessmentCodes: string[];
  description: string;
}

export const PHASE_META: Record<PhaseId, PhaseMeta> = {
  phase_1: {
    label: 'Phase 1 — Baseline Operational Assessment',
    shortLabel: 'Phase 1',
    name: 'Baseline Operational Assessment',
    enrollmentPhase: 'pre',
    assessmentCodes: ['active_threat_v1'],
    description:
      'Pre-training baseline measurement on the active-threat scenario.',
  },
  phase_2: {
    label: 'Phase 2 — Adaptive Performance Analysis',
    shortLabel: 'Phase 2',
    name: 'Adaptive Performance Analysis',
    enrollmentPhase: 'post',
    assessmentCodes: ['active_threat_v1'],
    description:
      'Post-training measurement on the same active-threat scenario. Pre→Post delta is the headline metric.',
  },
  phase_3: {
    label: 'Phase 3 — Operational Governance Certification',
    shortLabel: 'Phase 3',
    name: 'Operational Governance Certification',
    enrollmentPhase: 'post',
    assessmentCodes: [
      'mvs_test_bank_v1',
      'scenario_conversation_velocity_v1',
      'scenario_perception_narrowing_v1',
      'scenario_escalation_loop_v1',
      'scenario_team_velocity_v1',
      'scenario_recovery_drift_v1',
    ],
    description:
      'End-of-session-day certification battery: 50-Q multi-choice exam + video scenarios.',
  },
};

export const PHASE_ORDER: PhaseId[] = ['phase_1', 'phase_2', 'phase_3'];

export function getPhaseMeta(phase: PhaseId): PhaseMeta {
  return PHASE_META[phase];
}

// Reverse map: which phase owns this assessment code? Returns null when
// the code isn't in the doctrine mapping (e.g., a stale or test fixture).
export function phaseFor(assessmentCode: string): PhaseId | null {
  for (const id of PHASE_ORDER) {
    if (PHASE_META[id].assessmentCodes.includes(assessmentCode)) {
      return id;
    }
  }
  return null;
}
