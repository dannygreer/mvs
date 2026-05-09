'use client';

import { useState, useCallback } from 'react';
import type { Scenario, Phase, ScreenResponse } from '@/types';
import { submitAssessment } from '@/actions/quiz';
import TitleScreen from './TitleScreen';
import { ReadScreen, AnswerScreen } from './ScenarioScreen';
import ResultsScreen from './ResultsScreen';

type Step = 'title' | 'reading' | 'answering' | 'results';

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
}

export default function Quiz({
  scenario,
  enrollmentId,
  studentId,
  prefillFirstName,
  prefillLastName,
  prefillPhase,
}: QuizProps) {
  const isEnrolled = !!enrollmentId;
  const [step, setStep] = useState<Step>(
    isEnrolled && scenario ? 'reading' : 'title'
  );
  const [firstName, setFirstName] = useState(prefillFirstName ?? '');
  const [lastName, setLastName] = useState(prefillLastName ?? '');
  const [phase, setPhase] = useState<Phase>(prefillPhase ?? 'pre');
  const [currentScreenId, setCurrentScreenId] = useState(
    isEnrolled && scenario ? scenario.entryScreenId : ''
  );
  const [branchPath, setBranchPath] = useState('');
  const [responses, setResponses] = useState<ScreenResponse[]>([]);
  const [screenIndex, setScreenIndex] = useState(0);

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
      setStep('reading');
    },
    [scenario],
  );

  const handleContinueToAnswer = useCallback(() => {
    setStep('answering');
  }, []);

  const handleResponse = useCallback(
    async (
      optionLabel: string | null,
      rtMs: number,
      timedOut: boolean,
    ) => {
      // Build branch path incrementally
      const newPath = optionLabel
        ? branchPath
          ? `${branchPath}-${optionLabel}`
          : optionLabel
        : branchPath;

      const currentScreen = scenario.screens[currentScreenId];
      const selectedOption = optionLabel
        ? currentScreen?.options.find((o) => o.label === optionLabel)
        : null;

      const response: ScreenResponse = {
        screenId: currentScreenId,
        optionLabel,
        optionText: selectedOption?.text ?? null,
        rtMs,
        timedOut,
        branchPath: newPath,
      };

      const newResponses = [...responses, response];
      setResponses(newResponses);
      setBranchPath(newPath);

      // Determine next screen
      let nextScreenId: string | null = null;
      if (selectedOption) {
        nextScreenId = selectedOption.nextScreenId;
      } else {
        // Timed out — follow first option's route as default path
        nextScreenId = currentScreen?.options[0]?.nextScreenId ?? null;
      }

      if (nextScreenId && scenario.screens[nextScreenId]) {
        setCurrentScreenId(nextScreenId);
        setScreenIndex((prev) => prev + 1);
        setStep('reading');
      } else {
        // Terminal screen — submit data and show results
        const totalTime = newResponses.reduce((sum, r) => sum + r.rtMs, 0);
        const participantId = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${Date.now()}`;

        try {
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
        } catch (e) {
          console.error('Failed to submit assessment:', e);
        }

        setStep('results');
      }
    },
    [
      branchPath,
      responses,
      currentScreenId,
      scenario,
      firstName,
      lastName,
      phase,
      enrollmentId,
      studentId,
    ],
  );

  const screen = scenario.screens[currentScreenId];

  switch (step) {
    case 'title':
      return <TitleScreen onContinue={handleTitle} />;
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
          onResponse={handleResponse}
        />
      );
    }
    case 'results':
      return <ResultsScreen firstName={firstName} responses={responses} />;
  }
}
