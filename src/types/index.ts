// Phase selection. 'practice' was added in Day 4 for enrollments and is
// stored in responses_long.phase for un-graded runs.
export type Phase = 'pre' | 'post' | 'practice';
export type ResponseCategory = 'controlled' | 'acceptable' | 'premature' | 'unsafe';

// Scenario data types (loaded from DB)
//
// Phase 1 Freeze (migration 0012) adds:
//   - triggersMarkers per option (8-marker JSONB)
//   - commitmentMode + 9 classification tags per scenario

// Eight locked markers per Phase 1 Freeze doctrine.
export type MarkerKey =
  | 'escalation'
  | 'narrowing'
  | 'premature_commitment'
  | 'sequencing_break'
  | 'drift'
  | 'intervention'
  | 'recovery'
  | 'governance_instability';

export type TriggersMarkers = Partial<Record<MarkerKey, boolean>> & {
  [key: string]: boolean | undefined;
};

export type CommitmentMode = 'locked' | 'revisable';

export interface ScenarioOption {
  id: string;
  label: string;
  text: string;
  nextScreenId: string | null;
  triggersMarkers: TriggersMarkers;
}

export interface ScenarioScreen {
  id: string;
  dbId: string;
  // Day 11.5: nullable. Active-threat carries the branching narrative
  // here; recognition-test scenarios are null (setupText replaces it).
  text: string | null;
  prompt: string;
  timerSeconds: number;
  sortOrder: number;
  options: ScenarioOption[];
}

// Classification tags — pure metadata for cohort analytics.
export interface ScenarioClassification {
  domain: 'tactical' | 'medical' | 'leadership' | 'executive' | null;
  compressionLevel: 'low' | 'moderate' | 'high' | 'extreme' | null;
  ambiguity: 'low' | 'moderate' | 'high' | null;
  emotionalLoad: 'low' | 'moderate' | 'high' | null;
  sensoryComplexity: 'low' | 'moderate' | 'high' | null;
  authorityConflict: boolean | null;
  timePressure: 'low' | 'moderate' | 'high' | null;
  casualtyComplexity: 'none' | 'single' | 'multiple' | 'mass' | null;
  governanceChallenge: 'individual' | 'team' | 'organizational' | null;
}

export interface Scenario {
  dbId: string;
  scenarioId: string;
  version: string;
  title: string;
  entryScreenId: string;
  commitmentMode: CommitmentMode;
  classification: ScenarioClassification;
  screens: Record<string, ScenarioScreen>;
  // Day 11: when set, the runner shows the MP4 before Q1 and skips both
  // 'setup' and per-screen 'reading' (the video conveys the situation).
  videoUrl: string | null;
  videoDurationSeconds: number | null;
  // Day 11.5: scenario-level context text. Recognition-test scenarios
  // (Conversation Velocity, Perception Narrowing, Escalation Loop, Team
  // Velocity, Recovery Drift) show this once before Q1. Active-threat is
  // null here — its per-screen text evolves the branching narrative and
  // stays on each scenario_screens row.
  setupText: string | null;
}

// Snapshot of the options as displayed at decision time.
export interface PresentedOption {
  id: string;
  label: string;
  text: string;
}

// Per-screen response captured during quiz.
// Phase 1 Freeze: revisable scenarios produce multiple events per screen
// (original + N revisions); revisionNumber and isRevision identify which.
export interface ScreenResponse {
  screenId: string;
  optionLabel: string | null;
  optionText: string | null;
  optionId: string | null;            // selected ScenarioOption.id (null on timeout)
  rtMs: number;
  timedOut: boolean;
  branchPath: string;
  presentedOptions: PresentedOption[]; // snapshot at decision time
  isRevision: boolean;                 // false for original commit
  revisionNumber: number;              // 0 = original, 1+ = revisions
}

// DB row types
export interface ResponseLongRow {
  id: number;
  participant_id: string;
  first_name: string;
  last_name: string;
  phase: string;
  scenario_id: string;
  scenario_version: string;
  question_id: string;
  branch_path: string;
  option_selected: string | null;
  response_category: string | null;
  rt_ms: number;
  timed_out: boolean;
  timestamp: string;
  // Day 4: nullable links to enrollment + student. Existing rows have null.
  enrollment_id: string | null;
  student_id: string | null;
  // Phase 1 Freeze (migration 0012). All have DB defaults so write paths
  // can omit them; reads from select * always return the resolved values.
  event_markers?: Record<string, boolean>;
  presented_options?:
    | { id: string; label: string; text: string }[]
    | null;
  is_revision?: boolean;
  revises_response_event_id?: number | null;
  revision_number?: number;
}

export interface ResponseWideRow {
  id: number;
  participant_id: string;
  first_name: string;
  last_name: string;
  phase: string;
  scenario_id: string;
  scenario_version: string;
  branch_path: string;
  q1_answer: string | null;
  q1_rt: number | null;
  q2_answer: string | null;
  q2_rt: number | null;
  q3_answer: string | null;
  q3_rt: number | null;
  q4_answer: string | null;
  q4_rt: number | null;
  q5_answer: string | null;
  q5_rt: number | null;
  q6_answer: string | null;
  q6_rt: number | null;
  total_time: number;
  completed_at: string;
  // Day 4: nullable links to enrollment + student.
  enrollment_id: string | null;
  student_id: string | null;
  // Day 11 (migration 0013/0012). Terminal-screen ID for scenarios;
  // null for multi-choice assessments. Optional because write paths can
  // omit it (DB nullable default).
  outcome_state?: string | null;
}

// Multi-choice (Day 5)
export interface McOption {
  id: string;
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface McQuestion {
  id: string;
  sequence: number;
  prompt: string;
  timeLimitSeconds: number | null;
  options: McOption[];
}

export interface McResponse {
  questionId: string;
  sequence: number;
  optionLabel: 'A' | 'B' | 'C' | 'D' | null;
  optionId: string | null;
  rtMs: number;
  timedOut: boolean;
}

export interface ResponseTag {
  id: string;
  scenario_fk: string;
  screen_id: string;
  option_label: string;
  response_category: ResponseCategory;
}

export interface ScenarioListItem {
  id: string;
  scenario_id: string;
  version: string;
  title: string;
  is_active: boolean;
}

// Legacy — kept for existing quiz_results table
export interface QuizResult {
  id: number;
  first_name: string;
  last_name: string;
  answer_1: number;
  answer_2: number;
  answer_3: number;
  time_1_ms: number;
  time_2_ms: number;
  time_3_ms: number;
  total_time_ms: number;
  completed_at: string;
}
