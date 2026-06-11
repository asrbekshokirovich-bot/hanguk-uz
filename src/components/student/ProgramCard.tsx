import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EligibilityBadge } from './EligibilityBadge';
import { type ProgramWithUniversity, checkEligibility } from '@/hooks/useProgramSearch';
import { GraduationCap, MapPin, Globe, ExternalLink } from 'lucide-react';

interface ProgramCardProps {
  program: ProgramWithUniversity;
  studentProfile: { topik_level: number | null; ielts_score: number | null };
  lang: string;
}

function getLocalizedName(obj: { name_uz: string; name_en?: string | null; name_ko?: string | null; name_ru?: string | null }, lang: string) {
  if (lang === 'ko') return obj.name_ko || obj.name_en || obj.name_uz;
  if (lang === 'ru') return obj.name_ru || obj.name_en || obj.name_uz;
  if (lang === 'en') return obj.name_en || obj.name_uz;
  return obj.name_uz;
}

function getLocalizedCity(u: ProgramCardProps['program']['university'], lang: string) {
  if (lang === 'ko') return u.city_ko || u.city_en || u.city_uz;
  if (lang === 'ru') return u.city_ru || u.city_en || u.city_uz;
  if (lang === 'en') return u.city_en || u.city_uz;
  return u.city_uz;
}

function formatKRW(amount: number | null) {
  if (!amount) return '—';
  return `₩${amount.toLocaleString()}`;
}

export function ProgramCard({ program, studentProfile, lang }: ProgramCardProps) {
  const { t } = useTranslation();
  const { status, eligible, issues } = checkEligibility(program, studentProfile);
  const uni = program.university;

  const trackLabel = program.language_track === 'english'
    ? 'English'
    : program.language_track === 'korean'
    ? '한국어'
    : t('universities.bothTracks');

  const trackColor = program.language_track === 'english'
    ? 'bg-info/10 text-info dark:bg-info/30 dark:text-info'
    : program.language_track === 'korean'
    ? 'bg-success/10 text-success dark:bg-success/30 dark:text-success'
    : 'bg-primary/10 text-primary dark:bg-primary/30 dark:text-primary';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* University Header */}
        <div className="flex items-start gap-3">
          {uni.logo_url ? (
            <img src={uni.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-muted flex-shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{getLocalizedName(uni, lang)}</h3>
              {uni.is_partner && (
                <Badge variant="highlight" className="text-[10px] px-1.5 py-0">{t('universities.partner')}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {getLocalizedCity(uni, lang)}
              {uni.ranking && <span className="ml-2">#{uni.ranking}</span>}
            </div>
          </div>
          <EligibilityBadge status={status} eligible={eligible} issues={issues} />
        </div>

        {/* Program Info */}
        <div>
          <p className="font-medium text-sm">{program.program_name}</p>
          {program.faculty_name && (
            <p className="text-xs text-muted-foreground">{program.faculty_name}</p>
          )}
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px]">{program.program_level}</Badge>
          <Badge className={`text-[10px] border-0 ${trackColor}`}>{trackLabel}</Badge>
          {program.topik_requirement && (
            <Badge variant="outline" className="text-[10px]">TOPIK {program.topik_requirement}</Badge>
          )}
          {program.ielts_requirement && (
            <Badge variant="outline" className="text-[10px]">IELTS {program.ielts_requirement}</Badge>
          )}
        </div>

        {/* Tuition & Actions */}
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="text-xs">
            <span className="text-muted-foreground">{t('universities.tuition')}:</span>{' '}
            <span className="font-medium">
              {formatKRW(program.tuition_per_semester)}
              <span className="text-muted-foreground">/sem</span>
            </span>
          </div>
          {uni.website && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <a href={uni.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                {t('common.view')}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
