import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';

const STATUS_STEPS = [
  'documents_collection',
  'documents_translation',
  'apostille',
  'application_submitted',
  'university_response',
  'visa_documents',
  'completed'
] as const;

interface ProcessTrackerProps {
  currentStatus: string;
  compact?: boolean;
}

export function ProcessTracker({ currentStatus, compact = false }: ProcessTrackerProps) {
  const { t } = useTranslation();

  // Issue 5: fallback to 0 if status is unknown
  const rawIndex = STATUS_STEPS.indexOf(currentStatus as typeof STATUS_STEPS[number]);
  const currentIndex = rawIndex === -1 ? 0 : rawIndex;

  const getStepLabel = (step: string) => {
    const labels: Record<string, string> = {
      documents_collection: t('process.collectDocs', 'Hujjat yig\'ish'),
      documents_translation: t('process.translation', 'Tarjima'),
      apostille: t('process.apostille', 'Apostil'),
      application_submitted: t('process.submitted', 'Topshirildi'),
      university_response: t('process.response', 'Javob'),
      visa_documents: t('process.visa', 'Viza'),
      completed: t('process.done', 'Tayyor'),
    };
    return labels[step] || step;
  };

  const getStepStatus = (index: number): 'completed' | 'current' | 'upcoming' => {
    if (currentIndex > index) return 'completed';
    if (currentIndex === index) return 'current';
    return 'upcoming';
  };

  return (
    <div className={cn("w-full", compact ? "py-2" : "py-4")}>
      <div className="flex items-center w-full">
        {STATUS_STEPS.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === STATUS_STEPS.length - 1;

          return (
            <div key={step} className={cn("flex items-center", !isLast && "flex-1")}>
              {/* Step dot */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "rounded-full flex items-center justify-center transition-all",
                    compact ? "h-5 w-5" : "h-7 w-7",
                    status === 'completed' && "bg-success text-white",
                    status === 'current' && "bg-primary text-primary-foreground animate-pulse ring-4 ring-primary/20",
                    status === 'upcoming' && "border-2 border-muted-foreground/30 bg-background"
                  )}
                >
                  {status === 'completed' && (
                    <CheckCircle className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
                  )}
                  {status === 'current' && (
                    <div className={cn("rounded-full bg-primary-foreground", compact ? "h-1.5 w-1.5" : "h-2 w-2")} />
                  )}
                </div>
                {/* Label */}
                <span
                  className={cn(
                    "text-center mt-1 leading-tight max-w-[60px]",
                    compact ? "text-[8px]" : "text-[10px]",
                    status === 'completed' && "text-success dark:text-success font-medium",
                    status === 'current' && "text-primary font-semibold",
                    status === 'upcoming' && "text-muted-foreground"
                  )}
                >
                  {getStepLabel(step)}
                </span>
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 mx-1",
                    compact ? "h-0.5" : "h-[2px]",
                    "self-start",
                    compact ? "mt-2.5" : "mt-3.5",
                    currentIndex > index
                      ? "bg-success"
                      : currentIndex === index
                      ? "bg-gradient-to-r from-primary to-muted-foreground/30"
                      : "bg-muted-foreground/20 border-t border-dashed border-muted-foreground/30"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
