import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Check, Lock, BookOpen, Sparkles, FileEdit, BarChart3 } from 'lucide-react';

interface Step {
  number: number;
  labelKey: string;
  fallback: string;
  icon: React.ReactNode;
}

interface StudyPlanStepIndicatorProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
}

const steps: Step[] = [
  { number: 1, labelKey: 'study.stepLearn', fallback: 'Learn', icon: <BookOpen className="h-4 w-4" /> },
  { number: 2, labelKey: 'study.stepExample', fallback: 'Example', icon: <Sparkles className="h-4 w-4" /> },
  { number: 3, labelKey: 'study.stepWrite', fallback: 'Write', icon: <FileEdit className="h-4 w-4" /> },
  { number: 4, labelKey: 'study.stepAnalyze', fallback: 'Analyze', icon: <BarChart3 className="h-4 w-4" /> },
];

export function StudyPlanStepIndicator({ 
  currentStep, 
  completedSteps,
  onStepClick 
}: StudyPlanStepIndicatorProps) {
  const { t } = useTranslation();

  const canAccess = (stepNumber: number) => {
    // Can access if it's completed or the current/previous step
    return completedSteps.includes(stepNumber) || stepNumber <= currentStep;
  };

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.number);
          const isCurrent = step.number === currentStep;
          const isAccessible = canAccess(step.number);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.number} className="flex items-center flex-1">
              {/* Step Circle */}
              <button
                onClick={() => isAccessible && onStepClick?.(step.number)}
                disabled={!isAccessible}
                className={cn(
                  "flex flex-col items-center gap-1.5 transition-all",
                  isAccessible && !isCurrent && "cursor-pointer hover:opacity-80",
                  !isAccessible && "cursor-not-allowed opacity-50"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    isCompleted && "bg-green-500 border-green-500 text-white",
                    isCurrent && !isCompleted && "bg-primary border-primary text-primary-foreground",
                    !isCurrent && !isCompleted && isAccessible && "bg-muted border-border text-muted-foreground",
                    !isAccessible && "bg-muted border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : !isAccessible ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCurrent && "text-primary",
                    isCompleted && "text-green-600 dark:text-green-400",
                    !isCurrent && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {t(step.labelKey, step.fallback)}
                </span>
              </button>

              {/* Connector Line */}
              {!isLast && (
                <div className="flex-1 h-0.5 mx-2 mt-[-1rem]">
                  <div
                    className={cn(
                      "h-full transition-all",
                      isCompleted ? "bg-green-500" : "bg-border"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
