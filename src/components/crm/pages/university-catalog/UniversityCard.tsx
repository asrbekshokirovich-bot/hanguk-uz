import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Award, Building2, Gift, GraduationCap, MapPin, Star } from 'lucide-react';
import type { CatalogEntry } from '@/hooks/useUniversityCatalog';
import {
  admissionLabel,
  cityLabel,
  contractRange,
  displayName,
  focusGuideline,
  guidelinesForLevel,
  languageBadges,
  levelLabel,
  offeredLevels,
  periodLabel,
  type LevelFilter,
} from './format';

/** Saralash panelidan (operator / admin): nufuz, grant va qidirilgan yo'nalishga mos fakultetlar. */
export interface CardHighlights {
  tier: string | null;
  grant: string | null;
  directions: { names: string[]; more: number } | null;
}

interface Props {
  entry: CatalogEntry;
  /** Katalogda tanlangan daraja — karta o'sha darajaning ma'lumotini ko'rsatadi. */
  level?: LevelFilter;
  highlights?: CardHighlights;
  onOpen: (entry: CatalogEntry) => void;
}

/**
 * Katalogdagi bitta universitet. Xodim bir qarashda ko'rishi kerak bo'lgani:
 * nomi (ingliz + koreys), shahri, kontrakt narxi va TOPIK/IELTS talabi.
 */
export function UniversityCard({ entry, level = 'hammasi', highlights, onOpen }: Props) {
  const { primary, secondary } = displayName(entry);
  const city = cityLabel(entry);
  const latest = focusGuideline(entry, level);
  const contract = contractRange(latest);
  const badges = languageBadges(latest);
  const admission = admissionLabel(latest);
  const period = periodLabel(latest?.kontrakt_davri);
  const levels = offeredLevels(entry);
  const missingLabel =
    level === 'hammasi' || entry.guidelines.length === 0
      ? 'Excel yuklanmagan'
      : `${levelLabel(level)} Excel'i yuklanmagan`;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(entry);
        }
      }}
      className="cursor-pointer transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-snug line-clamp-2" title={primary}>
              {primary}
            </p>
            {secondary && (
              <p className="text-sm text-muted-foreground line-clamp-1" title={secondary}>
                {secondary}
              </p>
            )}
          </div>
          {entry.institution.is_partner && (
            <Star
              className="h-4 w-4 shrink-0 fill-warning text-warning"
              aria-label="Hamkor universitet"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {city}
            </span>
          )}
          {admission && (
            <span className="inline-flex items-center gap-1">
              <GraduationCap className="h-3 w-3" aria-hidden="true" />
              {admission}
            </span>
          )}
        </div>

        {highlights && (highlights.tier || highlights.grant) && (
          <div className="flex flex-wrap gap-1.5">
            {highlights.tier && (
              <Badge variant="neutral" className="gap-1 text-[11px]">
                <Award className="h-3 w-3" aria-hidden="true" />
                {highlights.tier}
              </Badge>
            )}
            {highlights.grant && (
              <Badge variant="warning" className="gap-1 text-[11px]">
                <Gift className="h-3 w-3" aria-hidden="true" />
                {highlights.grant}
              </Badge>
            )}
          </div>
        )}

        {highlights?.directions && highlights.directions.names.length > 0 && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            <span className="font-medium text-foreground">Mos yo'nalish:</span>{' '}
            {highlights.directions.names.join(', ')}
            {highlights.directions.more > 0 && ` va yana ${highlights.directions.more} ta`}
          </p>
        )}

        {latest ? (
          <>
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <Badge key={b.key} variant={b.key === 'topik' ? 'info' : 'successSoft'}>
                    {b.label}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-end justify-between gap-2 pt-0.5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Kontrakt</p>
                <p className="text-sm font-medium truncate" title={contract ?? undefined}>
                  {contract ?? '—'}
                  {contract && period && (
                    <span className="text-xs font-normal text-muted-foreground"> / {period}</span>
                  )}
                </p>
              </div>
              {latest.fakultet_soni > 0 && (
                <Badge variant="neutral" className="shrink-0">
                  {latest.fakultet_soni} fakultet
                </Badge>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            {missingLabel}
          </div>
        )}

        {/* Har bir daraja fayli alohida yuklanadi — universitetda bor darajalardan qaysi biri yuklangani shu yerdan ko'rinadi. */}
        <div className="flex flex-wrap gap-1.5">
          {levels.map((l) => {
            const loaded = guidelinesForLevel(entry, l).length > 0;
            return (
              <Badge key={l} variant={loaded ? 'successSoft' : 'neutral'} className="text-[11px]">
                {levelLabel(l)} {loaded ? '✓' : '—'}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
