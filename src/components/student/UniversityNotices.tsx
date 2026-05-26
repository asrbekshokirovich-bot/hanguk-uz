import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Megaphone, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TranslatedText } from '@/components/TranslatedText';
import { useInstitutionNotices } from '@/hooks/useInstitutionNotices';

/**
 * Applicant-facing list of a university's scraped notices (uni_db
 * announcements), titles shown in the user's language via the translations
 * table with a Korean fallback.
 */
export function UniversityNotices({ institutionId }: { institutionId: string | null }) {
  const { t } = useTranslation();
  const { notices, titles, isLoading } = useInstitutionNotices(institutionId);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (notices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
        <Megaphone className="h-12 w-12 mb-4 opacity-50" />
        <p>{t('announcements.none', "Hali e'lonlar yo'q")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 overflow-auto h-full">
      {notices.map((n) => (
        <Card key={n.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              {n.category ? (
                <Badge variant="secondary" className="text-[10px]">
                  {n.category.replace(/_/g, ' ')}
                </Badge>
              ) : (
                <span />
              )}
              {n.posted_at ? (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(n.posted_at), 'dd.MM.yyyy')}
                </span>
              ) : null}
            </div>

            <h4 className="font-semibold text-sm">
              <TranslatedText
                ko={n.title_ko}
                translation={(lang) => titles.get(n.id, 'title_ko', lang)}
                showHint
              />
            </h4>

            {n.url_ko ? (
              <a
                href={n.url_ko}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t('announcements.openNotice', 'Open notice')}
              </a>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
