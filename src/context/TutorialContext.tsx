import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

/**
 * Identifier for supported tutorials in the UI.
 */
export type TutorialId = 'demo-data';

/**
 * Definition for a single tutorial step.
 *
 * - `id`: unique identifier for the step within a tutorial.
 * - `targetId`: value of the `data-tutorial-id` attribute on the element to highlight.
 * - `title`: short title displayed in the tutorial card.
 * - `body`: explanatory text shown in the tutorial card.
 * - `requireActionToProceed`: when true, the "Next" button will be disabled until
 *   `markActionCompleted` is called for this step.
 */
export interface TutorialStepDefinition {
  id: string;
  targetId: string;
  title: string;
  body: string;
  requireActionToProceed?: boolean;
}

interface TutorialStepState extends TutorialStepDefinition {
  tutorialId: TutorialId;
}

/**
 * In-memory configuration of tutorials.
 *
 * This is intentionally simple and focused on the minimal "demo data" flow.
 */
const TUTORIAL_DEFINITIONS: Record<TutorialId, TutorialStepDefinition[]> = {
  'demo-data': [
    {
      id: 'demo-step-1-data-table',
      targetId: 'demo-model-response-column',
      title: 'Load Taubench',
      body: 'This demo is from Taubench, an agentic benchmark where an LLM acts like a customer service agent. Each row is a model response – click a "View" button in this column to see its traces.',
      requireActionToProceed: false,
    },
    {
      id: 'demo-step-2-extract-trace',
      targetId: 'extract-properties-trace',
      title: 'Property extraction trace',
      body: 'Use property extraction to turn raw model responses into structured properties you can analyze.',
      requireActionToProceed: false,
    },
    {
      id: 'demo-step-3-extract-row-0',
      targetId: 'extract-row-0',
      title: 'Try extracting a single row',
      body: 'Start by extracting properties for the selected row. This lets you preview how the extractor works on one example before running it on all rows.',
      requireActionToProceed: true,
    },
    {
      id: 'demo-step-4-view-properties',
      targetId: 'extraction-results-panel',
      title: 'View extracted properties',
      body: 'Click on each LLM annotated behavior to see more information.',
      requireActionToProceed: false,
    },
    {
      id: 'demo-step-5-extract-all-rows',
      targetId: 'extract-all-rows',
      title: 'Run extraction for your whole dataset',
      body: 'Once you like the properties extracted from the selected row, click "Run on all traces" to apply the extractor to the entire dataset.',
      requireActionToProceed: false,
    },
  ],
};

/**
 * Shape of the tutorial context exposed to the rest of the app.
 *
 * - `activeTutorialId`: currently active tutorial or null when inactive.
 * - `currentStepIndex`: zero-based index into the active tutorial's steps.
 * - `steps`: resolved steps for the active tutorial (or null when inactive).
 * - `completedTutorials`: map of tutorials that have been completed or skipped.
 * - `startTutorial`: start a tutorial at its first step.
 * - `nextStep`: advance to the next step (no-op if on last step).
 * - `prevStep`: go back to the previous step (no-op if on first step).
 * - `skipTutorial`: close the tutorial and mark it as completed.
 * - `finishTutorial`: explicitly finish the tutorial and mark it as completed.
 * - `markActionCompleted`: mark a step's required action as completed to enable "Next".
 * - `isNextDisabled`: true when the current step requires an action that has not yet completed.
 */
export interface TutorialContextValue {
  activeTutorialId: TutorialId | null;
  currentStepIndex: number;
  steps: TutorialStepState[] | null;
  completedTutorials: Record<TutorialId, boolean>;
  startTutorial: (id: TutorialId) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  finishTutorial: () => void;
  markActionCompleted: (tutorialId: TutorialId, stepId: string) => void;
  isNextDisabled: boolean;
}

const TutorialContext = React.createContext<TutorialContextValue | null>(null);

/**
 * Hook to access the tutorial context.
 *
 * Returns `null` when used outside of `TutorialProvider`, so callers
 * should guard against a null value before using context actions.
 */
export function useTutorial(): TutorialContextValue | null {
  return React.useContext(TutorialContext);
}

/**
 * Internal spotlight overlay that dims the background and highlights the
 * current tutorial target element with a border and a floating card.
 */
function TutorialOverlay({
  activeTutorialId,
  currentStepIndex,
  steps,
  isNextDisabled,
  onNext,
  onPrev,
  onSkip,
  onFinish,
}: {
  activeTutorialId: TutorialId | null;
  currentStepIndex: number;
  steps: TutorialStepState[] | null;
  isNextDisabled: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);

  const step = React.useMemo(() => {
    if (!activeTutorialId || !steps || currentStepIndex < 0 || currentStepIndex >= steps.length) {
      return null;
    }
    return steps[currentStepIndex];
  }, [activeTutorialId, steps, currentStepIndex]);

  React.useEffect(() => {
    if (!step) {
      setTargetRect(null);
      return;
    }

    let cancelled = false;

    const updateRect = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tutorial-id="${step.targetId}"]`);
      if (!el) {
        setTargetRect(null);
        return;
      }
      setTargetRect(el.getBoundingClientRect());
    };

    // Initial attempt in case the element is already mounted
    updateRect();

    const handleLayoutChange = () => {
      updateRect();
    };

    window.addEventListener('resize', handleLayoutChange);
    // Capture scroll events from nested scroll containers
    window.addEventListener('scroll', handleLayoutChange, true);

    // Keep polling while this step is active so late-mounted elements are picked up
    const intervalId = window.setInterval(updateRect, 300);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
    };
  }, [step]);

  if (!activeTutorialId || !steps || !step) {
    return null;
  }

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handlePrimary = () => {
    if (isLastStep) {
      onFinish();
    } else {
      onNext();
    }
  };

  // Compute card position:
  // - Pin the tutorial card across the top of the screen so it visually
  //   covers the header area while leaving the main content unobstructed.
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const cardMaxWidth = 720;
  const defaultPadding = 12;
  const cardTop = 0;
  let cardLeft = defaultPadding;
  if (viewportWidth > 0) {
    const idealLeft = viewportWidth / 2 - cardMaxWidth / 2;
    const maxLeft = Math.max(defaultPadding, viewportWidth - cardMaxWidth - defaultPadding);
    cardLeft = Math.min(Math.max(idealLeft, defaultPadding), maxLeft);
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      {/* Highlight border around target (if found) - skip for property extraction trace textbox */}
      {targetRect && step.targetId !== 'extract-properties-trace' && (
        <Box
          sx={{
            position: 'absolute',
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            borderRadius: 2,
            border: '2px solid #22C55E',
            boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.5)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tutorial card */}
      <Box
        sx={{
          position: 'absolute',
          top: cardTop,
          left: cardLeft,
          maxWidth: cardMaxWidth,
          pointerEvents: 'auto',
        }}
      >
        <Box
          sx={{
            p: 1.25,
            borderRadius: 0,
            backgroundColor: '#FAFDFB',
            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.25)',
            border: '2px solid #22C55E',
            position: 'relative',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.25 }}>
            {step.title}
          </Typography>
          <Typography variant="body2" sx={{ color: '#4B5563', mb: 1 }}>
            {step.body}
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1}>
              {!isFirstStep && (
                <Button
                  size="small"
                  variant="text"
                  onClick={onPrev}
                  sx={{ color: '#22C55E' }}
                >
                  Back
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                onClick={handlePrimary}
                disabled={isNextDisabled}
                sx={{ 
                  backgroundColor: '#22C55E',
                  '&:hover': {
                    backgroundColor: '#16A34A',
                  },
                }}
              >
                {isLastStep ? 'Finish' : 'Next'}
              </Button>
            </Stack>
            <Button
              size="small"
              variant="text"
              onClick={onSkip}
              sx={{ color: '#22C55E' }}
            >
              Skip tutorial
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Provider that owns tutorial state and renders the spotlight overlay.
 */
export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [activeTutorialId, setActiveTutorialId] = React.useState<TutorialId | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = React.useState<number>(0);
  const [completedStepIds, setCompletedStepIds] = React.useState<Set<string>>(new Set());

  /**
   * Track which tutorials have been completed or skipped, persisted in localStorage.
   *
   * The localStorage keys are simple booleans per tutorial (no JSON structure)
   * to avoid parsing errors.
   */
  const [completedTutorials, setCompletedTutorials] = React.useState<Record<TutorialId, boolean>>(
    () => {
      if (typeof window === 'undefined') {
        return { 'demo-data': false };
      }
      const demoCompleted = window.localStorage.getItem('stringsight.tutorial.demo-data.completed') === 'true';
      return { 'demo-data': demoCompleted };
    },
  );

  const steps: TutorialStepState[] | null = React.useMemo(() => {
    if (!activeTutorialId) return null;
    const defs = TUTORIAL_DEFINITIONS[activeTutorialId] || [];
    return defs.map((def) => ({
      ...def,
      tutorialId: activeTutorialId,
    }));
  }, [activeTutorialId]);

  const isNextDisabled = React.useMemo(() => {
    if (!activeTutorialId || !steps || currentStepIndex < 0 || currentStepIndex >= steps.length) {
      return false;
    }
    const step = steps[currentStepIndex];
    if (!step.requireActionToProceed) {
      return false;
    }
    return !completedStepIds.has(step.id);
  }, [activeTutorialId, steps, currentStepIndex, completedStepIds]);

  const startTutorial = React.useCallback((id: TutorialId) => {
    const defs = TUTORIAL_DEFINITIONS[id];
    if (!defs || defs.length === 0) {
      return;
    }

    const initialCompleted = new Set<string>();
    defs.forEach((def) => {
      if (!def.requireActionToProceed) {
        initialCompleted.add(def.id);
      }
    });

    setActiveTutorialId(id);
    setCurrentStepIndex(0);
    setCompletedStepIds(initialCompleted);
  }, []);

  const clearActiveTutorial = React.useCallback(() => {
    setActiveTutorialId(null);
    setCurrentStepIndex(0);
    setCompletedStepIds(new Set());
  }, []);

  const updateCompletedTutorials = React.useCallback((id: TutorialId) => {
    setCompletedTutorials((prev) => {
      const next = { ...prev, [id]: true };
      if (typeof window !== 'undefined') {
        if (id === 'demo-data') {
          window.localStorage.setItem('stringsight.tutorial.demo-data.completed', 'true');
        }
      }
      return next;
    });
  }, []);

  const nextStep = React.useCallback(() => {
    if (!activeTutorialId || !steps) return;
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((idx) => idx + 1);
    }
  }, [activeTutorialId, steps, currentStepIndex]);

  const prevStep = React.useCallback(() => {
    if (!activeTutorialId || !steps) return;
    if (currentStepIndex > 0) {
      setCurrentStepIndex((idx) => idx - 1);
    }
  }, [activeTutorialId, steps, currentStepIndex]);

  const skipTutorial = React.useCallback(() => {
    if (!activeTutorialId) return;
    const id = activeTutorialId;
    clearActiveTutorial();
    updateCompletedTutorials(id);
  }, [activeTutorialId, clearActiveTutorial, updateCompletedTutorials]);

  const finishTutorial = React.useCallback(() => {
    if (!activeTutorialId) return;
    const id = activeTutorialId;
    clearActiveTutorial();
    updateCompletedTutorials(id);
  }, [activeTutorialId, clearActiveTutorial, updateCompletedTutorials]);

  const markActionCompleted = React.useCallback(
    (tutorialId: TutorialId, stepId: string) => {
      if (!activeTutorialId || tutorialId !== activeTutorialId) return;
      setCompletedStepIds((prev) => {
        if (prev.has(stepId)) return prev;
        const next = new Set(prev);
        next.add(stepId);
        return next;
      });
    },
    [activeTutorialId],
  );

  const value: TutorialContextValue = React.useMemo(
    () => ({
      activeTutorialId,
      currentStepIndex,
      steps,
      completedTutorials,
      startTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      finishTutorial,
      markActionCompleted,
      isNextDisabled,
    }),
    [
      activeTutorialId,
      currentStepIndex,
      steps,
      completedTutorials,
      startTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      finishTutorial,
      markActionCompleted,
      isNextDisabled,
    ],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <TutorialOverlay
        activeTutorialId={activeTutorialId}
        currentStepIndex={currentStepIndex}
        steps={steps}
        isNextDisabled={isNextDisabled}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTutorial}
        onFinish={finishTutorial}
      />
    </TutorialContext.Provider>
  );
}


