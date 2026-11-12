import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The back arrow of a public page (privacy, terms, support).
 *
 * These pages are opened straight from a store listing, from the app or from
 * a shared link as often as from the site itself. Then there is nothing in the
 * tab to go back to and the arrow did nothing; now it leads to the home page.
 * It also has a name, for a screen reader.
 */
export function BackButton({ fallback = '/' }: { fallback?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const back = () => {
    // 'default' is the key of the entry the site was opened on.
    if (location.key === 'default') navigate(fallback, { replace: true });
    else navigate(-1);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="flex-shrink-0"
      onClick={back}
      aria-label={t('common.back', { defaultValue: 'Back' })}
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}
