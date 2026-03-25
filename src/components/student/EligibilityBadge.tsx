import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Check, X, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type EligibilityStatus } from '@/hooks/useProgramSearch';

interface EligibilityBadgeProps {
  status: EligibilityStatus;
  eligible: boolean;
  issues: string[];
}

export function EligibilityBadge({ status, issues }: EligibilityBadgeProps) {
  const { t } = useTranslation();

  if (status === 'eligible') {
    return (
      <Badge variant="success" className="gap-1">
        <Check className="h-3 w-3" />
        {t('finder.eligible', 'Eligible')}
      </Badge>
    );
  }

  if (status === 'unknown') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1 cursor-help">
              <HelpCircle className="h-3 w-3" />
              {t('finder.updateProfile', 'Update Profile')}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{t('finder.updateProfileHint', 'Add your TOPIK/IELTS scores to check eligibility')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="gap-1 cursor-help">
            <X className="h-3 w-3" />
            {t('finder.notEligible', 'Not Eligible')}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <ul className="text-xs space-y-1">
            {issues.map((issue, i) => (
              <li key={i}>• {issue}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
