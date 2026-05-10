// Phase selection. 'practice' was added in Day 4 for enrollments and is
// stored in responses_long.phase for un-graded runs.
export type Phase = 'pre' | 'post' | 'practice';
export type ResponseCategory = 'controlled' | 'acceptable' | 'premature' | 'unsafe';

// Scenario data types (loaded from DB)
export interface ScenarioOption {
  id: string;
  label: string;
  text: string;
  nextScreenId: string | null;
}

export interface ScenarioScreen {
  id: string;
  dbId: string;
  text: string;
  prompt: string;
  timerSeconds: number;
  sortOrder: number;
  options: ScenarioOption[];
}

export interface Scenario {
  dbId: string;
  scenarioId: string;
  version: string;
  title: string;
  entryScreenId: string;
  screens: Record<string, ScenarioScreen>;
}

// Per-screen response captured during quiz
export interface ScreenResponse {
  screenId: string;
  optionLabel: string | null;
  optionText: string | null;
  rtMs: number;
  timedOut: boolean;
  branchPath: string;
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
