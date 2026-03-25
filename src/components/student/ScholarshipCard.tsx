import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Scholarship } from '@/hooks/useScholarships';
import { Award, Calendar, ExternalLink, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';

interface ScholarshipCardProps {
  scholarship: Scholarship;
  lang: string;
}

function getLocalizedField(s: Scholarship, field: 'name' | 'description', lang: string) {
  const key = `${field}_${lang === 'ko' ? 'ko' : lang === 'ru' ? 'ru' : lang === 'en' ? 'en' : 'uz'}` as keyof Scholarship;
  return (s[key] as string | null) || s[field] || '';
}

const typeColors: Record<string, string> = {
  government: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  university: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  partner: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  external: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const typeLabels: Record<string, string> = {
  government: 'GKS / Government',
  university: 'University',
  partner: 'Partner',
  external: 'External',
};

export function ScholarshipCard({ scholarship, lang }: ScholarshipCardProps) {
  const { t } = useTranslation();
  const s = scholarship;

  const uniName = s.university
    ? (lang === 'ko' ? s.university.name_ko : lang === 'ru' ? s.university.name_ru : lang === 'en' ? s.university.name_en : s.university.name_uz) || s.university.name_uz
    : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{getLocalizedField(s, 'name', lang)}</h3>
            {uniName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <GraduationCap className="h-3 w-3" /> {uniName}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {getLocalizedField(s, 'description', lang) && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {getLocalizedField(s, 'description', lang)}
          </p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge className={`text-[10px] border-0 ${typeColors[s.scholarship_type] || typeColors.external}`}>
            {typeLabels[s.scholarship_type] || s.scholarship_type}
          </Badge>
          {s.coverage && (
            <Badge variant="secondary" className="text-[10px]">
              {s.coverage.replace(/_/g, ' ')}
            </Badge>
          )}
          {s.program_level && (
            <Badge variant="outline" className="text-[10px]">{s.program_level}</Badge>
          )}
        </div>

        {/* Amount & Deadline */}
        <div className="flex items-center justify-between pt-1 border-t text-xs">
          <div>
            {s.amount_description ? (
              <span className="font-medium">{s.amount_description}</span>
            ) : s.amount_krw ? (
              <span className="font-medium">₩{s.amount_krw.toLocaleString()}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {s.application_deadline && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(s.application_deadline), 'MMM d, yyyy')}
              </span>
            )}
            {s.application_url && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <a href={s.application_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  {t('finder.apply', 'Apply')}
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
