'use client';

import { useState, useCallback, useRef } from 'react';
import type {
  Scenario,
  Phase,
  ScreenResponse,
  PresentedOption,
} from '@/types';
import { submitAssessment, submitAssessmentByToken } from '@/actions/quiz';
import TitleScreen from './TitleScreen';
import { ReadScreen, AnswerScreen, type AnswerEvent } from './ScenarioScreen';
import ResultsScreen from './ResultsScreen';
import ScenarioVideo from './ScenarioVideo';
import PreviewBanner from './PreviewBanner';

// Step state machine. Priority is video > setup > per-screen reading:
//   - videoUrl set      → 'video' before Q1, no reading between Qs.
//   - setupText set     → 'setup' once before Q1, no reading between Qs.
//   - neither (active-  → 'reading' before each Q (branching narrative).
//     threat path)
// Day 11 added 'video'; Day 11.5 added 'setup'.
type Step =
  | 'title'
  | 'video'
  | 'setup'
  | 'reading'
  | 'answering'
  | 'results';

function pickStartingStep(scenario: Scenario, isEnrolled: boolean): Step {
  if (!isEnrolled) return 'title';
  if (scenario.videoUrl) return 'video';
  if (scenario.setupText !== null) return 'setup';
  return 'reading';
}

function pickStepBetweenScreens(scenario: Scenario): Step {
  // What runs between question N and question N+1.
  // Recognition-test (setupText) scenarios: skip 'reading' — the setup
  // covered context, and per-screen text is null anyway.
  // Video scenarios likewise skip reading (the video doesn't replay).
  // Active-threat (per-screen narrative): show 'reading' for the next
  // screen's branching text.
  if (scenario.videoUrl || scenario.setupText !== null) return 'answering';
  return 'reading';
}

interface QuizProps {
  scenario: Scenario | null;
  // Day 4 — enrollment context (set when invoked from /app/take/[id]).
  // Presence of `enrollmentId` causes the title screen to be skipped and
  // identity to be prefilled from the authenticated session.
  enrollmentId?: string;
  studentId?: string;
  prefillFirstName?: string;
  prefillLastName?: string;
  prefillPhase?: Phase;
  // Day 5b — token-URL mode (no auth). Set by /take/[token] route. When
  // present, submission goes through submitAssessmentByToken which derives
  // enrollment + student from the token server-side.
  token?: string;
  // Preview mode (admin QA). Same UI, same timing, same revisable/video
  // doctrine guards — but the terminal submission call is skipped. No row
  // touches responses_long / responses_wide / enrollments. Renders the
  // PreviewBanner at the top of every screen.
  previewMode?: boolean;
}

export default function Quiz({
  scenario,
  enrollmentId,
  studentId,
  prefillFirstName,
  prefillLastName,
  prefillPhase,
  token,
  previewMode,
}: QuizProps) {
  const isEnrolled = !!enrollmentId || !!token;
  // Initial step decided by pickStartingStep (video > setup > reading,
  // with 'title' fallback for the anonymous walk-in path).
  const initialStep: Step = scenario
    ? pickStartingStep(scenario, isEnrolled)
    : 'title';
  const [step, setStep] = useState<Step>(initialStep);
  const [firstName, setFirstName] = useState(prefillFirstName ?? '');
  const [lastName, setLastName] = useState(prefillLastName ?? '');
  const [phase, setPhase] = useState<Phase>(prefillPhase ?? 'pre');
  const [currentScreenId, setCurrentScreenId] = useState(
    isEnrolled && scenario ? scenario.entryScreenId : ''
  );
  const [branchPath, setBranchPath] = useState('');
  const [responses, setResponses] = useState<ScreenResponse[]>([]);
  const [screenIndex, setScreenIndex] = useState(0);
  // Phase 1 Freeze: revisable mode emits multiple events per screen. The
  // counter resets per screen via the AnswerScreen `key` prop remount, but
  // we track it in a ref so the collator can assign revision_number without
  // a re-render race.
  const revisionCountRef = useRef(0);

  if (!scenario) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="text-zinc-500 text-lg">
          No active scenario configured. Please contact an administrator.
        </p>
      </div>
    );
  }

  const handleTitle = useCallback(
    (fn: string, ln: string, p: Phase) => {
      setFirstName(fn);
      setLastName(ln);
      setPhase(p);
      setCurrentScreenId(scenario.entryScreenId);
      setScreenIndex(0);
      setBranchPath('');
      setResponses([]);
      revisionCountRef.current = 0;
      // After title (anonymous walk-in), enter the intro step that matches
      // this scenario's shape.
      if (scenario.videoUrl) setStep('video');
      else if (scenario.setupText !== null) setStep('setup');
      else setStep('reading');
    },
    [scenario],
  );

  const handleContinueToAnswer = useCallback(() => {
    setStep('answering');
  }, []);

  // Day 11: video ended → straight to 'answering' (skip 'reading').
  // The AnswerScreen's startTimeRef anchors when AnswerScreen mounts, so
  // Q1's RT correctly begins from the moment the question UI paints, NOT
  // from page load.
  const handleVideoEnded = useCallback(() => {
    setStep('answering');
  }, []);

  // Day 11.5: setup screen continue → directly to 'answering'. Same RT
  // semantics as the video path — Q1's startTimeRef anchors at AnswerScreen
  // mount, not at setup-screen mount.
  const handleSetupContinue = useCallback(() => {
    setStep('answering');
  }, []);

  // Collate AnswerEvent -> ScreenResponse. In locked mode this fires once
  // per screen (kind='commit'). In revisable mode it fires once per Change
  // (kind='revise') plus once on Continue (kind='commit'); the collator
  // increments revision_number on each event and only advances to the next
  // screen when kind='commit'.
  const handleAnswerEvent = useCallback(
    async (event: AnswerEvent) => {
      const currentScreen = scenario.screens[currentScreenId];
      const presentedOptions: PresentedOption[] =
        currentScreen?.options.map((o) => ({
          id: o.id,
          label: o.label,
          text: o.text,
        })) ?? [];

      const newPath = event.optionLabel
        ? branchPath
          ? `${branchPath}-${event.optionLabel}`
          : event.optionLabel
        : branchPath;

      const selectedOption = event.optionLabel
        ? currentScreen?.options.find((o) => o.label === event.optionLabel)
        : null;

      const revisionNumber = revisionCountRef.current;
      const response: ScreenResponse = {
        screenId: currentScreenId,
        optionLabel: event.optionLabel,
        optionText: selectedOption?.text ?? null,
        optionId: event.optionId,
        rtMs: event.rtMs,
        timedOut: event.timedOut,
        // branch_path on revisions is the path AT THE MOMENT of that pick.
        // For revisions, we use the original screen's branchPath (no advance).
        // For commits, we use the new path (the one that branches forward).
        branchPath: event.kind === 'commit' ? newPath : branchPath,
        presentedOptions,
        isRevision: revisionNumber > 0,
        revisionNumber,
      };

      const newResponses = [...responses, response];
      setResponses(newResponses);

      if (event.kind === 'revise') {
        // Stay on this screen, bump revision count, await next event.
        revisionCountRef.current = revisionNumber + 1;
        return;
      }

      // kind === 'commit' — terminal pick for this screen. Advance or finish.
      setBranchPath(newPath);
      revisionCountRef.current = 0;

      let nextScreenId: string | null = null;
      if (selectedOption) {
        nextScreenId = selectedOption.nextScreenId;
      } else {
        // Timed out, no pick — follow first option's route as default path.
        nextScreenId = currentScreen?.options[0]?.nextScreenId ?? null;
      }

      if (nextScreenId && scenario.screens[nextScreenId]) {
        setCurrentScreenId(nextScreenId);
        setScreenIndex((prev) => prev + 1);
        // Day 11.5: video / setup-text scenarios bypass per-screen reading.
        // Active-threat (per-screen branching narrative) still uses 'reading'.
        setStep(pickStepBetweenScreens(scenario));
        return;
      }

      // Terminal screen — submit data and show results.
      // Preview mode (admin QA): skip the submission entirely. The runner
      // still transitions to 'results' so the admin sees the full flow,
      // but no rows touch responses_long / responses_wide / enrollments.
      const totalTime = newResponses.reduce((sum, r) => sum + r.rtMs, 0);
      const participantId = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${Date.now()}`;

      if (!previewMode) {
        try {
          if (token) {
            await submitAssessmentByToken({
              token,
              scenarioId: scenario.scenarioId,
              scenarioVersion: scenario.version,
              branchPath: newPath,
              responses: newResponses,
              totalTime,
            });
          } else {
            await submitAssessment({
              participantId,
              firstName,
              lastName,
              phase,
              scenarioId: scenario.scenarioId,
              scenarioVersion: scenario.version,
              branchPath: newPath,
              responses: newResponses,
              totalTime,
              enrollmentId,
              studentId,
            });
          }
        } catch (e) {
          console.error('Failed to submit assessment:', e);
        }
      }

      setStep('results');
    },
    [
      previewMode,
      branchPath,
      responses,
      currentScreenId,
      scenario,
      firstName,
      lastName,
      phase,
      enrollmentId,
      studentId,
      token,
    ],
  );

  const screen = scenario.screens[currentScreenId];

  // Render the active step's content, then wrap with the optional preview
  // banner. The IIFE keeps the existing per-case logic untouched (some
  // cases have setStep() side effects on first paint which were already
  // there and continue to work).
  const stepContent: React.ReactNode = (() => {
  switch (step) {
    case 'title':
      return <TitleScreen onContinue={handleTitle} />;
    case 'setup': {
      // Recognition-test scenarios (Conversation Velocity, etc.) show
      // scenario.setupText once with a Continue button. Q1's RT starts
      // when AnswerScreen mounts after this step transitions, NOT here.
      if (!scenario.setupText) {
        // Defensive fallback: a scenario shouldn't reach 'setup' without
        // setupText, but if it does, go straight to reading.
        setStep('reading');
        return null;
      }
      return (
        <div className="relative flex flex-col items-center justify-center flex-1 px-6 py-12">
          <div className="absolute inset-0 bg-zinc-100" />
          <div className="relative w-full max-w-2xl space-y-8">
            <div className="bg-white border border-zinc-200 rounded-xl p-8 space-y-4">
              <h2 className="text-lg font-medium text-zinc-500 uppercase tracking-wide">
                Scenario
              </h2>
              <p className="text-xl text-zinc-900 leading-relaxed whitespace-pre-line">
                {scenario.setupText}
              </p>
            </div>
            <button
              onClick={handleSetupContinue}
              className="w-full py-3 rounded-lg font-medium text-lg transition-colors bg-zinc-900 text-white hover:bg-zinc-800"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }
    case 'video': {
      if (!scenario.videoUrl || scenario.videoDurationSeconds == null) {
        // Defensive: should never happen — initialStep guards this — but if
        // a scenario somehow lands here without a video, fall through to
        // the text-only reading path so the student isn't stuck.
        return (
          <ReadScreen
            key={`read-${currentScreenId}`}
            screen={screen!}
            screenNumber={screenIndex + 1}
            onContinue={handleContinueToAnswer}
          />
        );
      }
      return (
        <div className="flex items-center justify-center flex-1 px-6 py-12 bg-black">
          <ScenarioVideo
            src={scenario.videoUrl}
            durationSeconds={scenario.videoDurationSeconds}
            onEnded={handleVideoEnded}
          />
        </div>
      );
    }
    case 'reading': {
      if (!screen) {
        return (
          <div className="flex items-center justify-center flex-1">
            <p className="text-zinc-500">
              Error: Screen &quot;{currentScreenId}&quot; not found.
            </p>
          </div>
        );
      }
      return (
        <ReadScreen
          key={`read-${currentScreenId}`}
          screen={screen}
          screenNumber={screenIndex + 1}
          onContinue={handleContinueToAnswer}
        />
      );
    }
    case 'answering': {
      if (!screen) {
        return (
          <div className="flex items-center justify-center flex-1">
            <p className="text-zinc-500">
              Error: Screen &quot;{currentScreenId}&quot; not found.
            </p>
          </div>
        );
      }
      return (
        <AnswerScreen
          key={`answer-${currentScreenId}`}
          screen={screen}
          screenNumber={screenIndex + 1}
          commitmentMode={scenario.commitmentMode}
          onResponse={handleAnswerEvent}
        />
      );
    }
    case 'results':
      return <ResultsScreen firstName={firstName} responses={responses} />;
  }
  return null;
  })();

  return (
    <>
      {previewMode && <PreviewBanner />}
      {stepContent}
    </>
  );
}
