import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActiveIntake, type Intake } from '@/contexts/IntakeContext';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * The nightly auto-crawl targets ONE admission cycle — the CRM's DEFAULT intake
 * (`public.intakes` where is_default). The backend reads exactly that row
 * (guideline_finder.fetch_target_cycle → year + season), so this panel is the
 * single, honest control for "which semester does the cloud crawl for": it shows
 * the current target and lets an owner/admin repoint it by changing the default
 * intake (the same lever as Manage Intakes, surfaced here on the crawl-review
 * page). No separate crawl-target setting — intakes stay the single source of truth.
 *
 * Restyled per design_handoff/uni_db_review (crawl-target bar): calendar icon
 * tile, "Avto-skaner mavsumi" + current-target pill, helper line; the intake
 * Select stays admin-gated exactly as before.
 */

export function CrawlTargetPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { intakes, isLoading } = useActiveIntake();
  const { isAdmin } = useUserRole();
  const [busy, setBusy] = useState(false);

  const intakeLabel = (i: Intake): string =>
    `${t(`uniReview.crawl.${i.season === 'spring' ? 'spring' : 'fall'}`)} ${i.year} · ${i.year}학년도`;

  const target = intakes.find((i) => i.is_default) ?? null;

  const setDefault = async (intakeId: string) => {
    if (!intakeId || intakeId === target?.id) return;
    setBusy(true);
    // A partial unique index allows only one default → unset first, then set.
    const { error: unsetErr } = await supabase
      .from('intakes')
      .update({ is_default: false })
      .eq('is_default', true);
    if (unsetErr) {
      setBusy(false);
      return void toast.error(unsetErr.message);
    }
    const { error } = await supabase
      .from('intakes')
      .update({ is_default: true })
      .eq('id', intakeId);
    setBusy(false);
    if (error) return void toast.error(error.message);
    const picked = intakes.find((i) => i.id === intakeId);
    toast.success(t('uniReview.crawl.updated', { label: picked ? intakeLabel(picked) : intakeId }));
    qc.invalidateQueries({ queryKey: ['intakes'] });
  };

  const years = [...new Set(intakes.map((i) => i.year))].sort((a, b) => b - a);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-3.5 px-[18px] shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-info/10 text-info">
          <CalendarClock className="h-[19px] w-[19px]" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{t('uniReview.crawl.label')}</span>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : target ? (
              <span className="inline-flex h-[22px] items-center rounded-full bg-info/10 px-2.5 text-[11.5px] font-semibold text-info">
                {intakeLabel(target)}
              </span>
            ) : (
              <span className="inline-flex h-[22px] items-center rounded-full bg-warning/10 px-2.5 text-[11.5px] font-semibold text-warning">
                {t('uniReview.crawl.noDefault')}
              </span>
            )}
          </div>
          <span className="text-[12.5px] text-muted-foreground/80">
            {t('uniReview.crawl.helper')}
          </span>
        </div>
      </div>

      {isAdmin ? (
        <div className="flex items-center gap-2">
          <Select value={target?.id ?? ''} onValueChange={setDefault} disabled={busy || isLoading}>
            <SelectTrigger className="h-[34px] w-[210px] text-[13px] font-semibold">
              <SelectValue placeholder={t('uniReview.crawl.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) =>
                (['spring', 'fall'] as const).map((season) => {
                  const i = intakes.find((x) => x.season === season && x.year === year);
                  if (!i) return null;
                  return (
                    <SelectItem key={i.id} value={i.id}>
                      {intakeLabel(i)}
                      {i.is_open ? '' : ` · ${t('uniReview.crawl.planning')}`}
                    </SelectItem>
                  );
                }),
              )}
            </SelectContent>
          </Select>
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">{t('uniReview.crawl.adminsOnly')}</span>
      )}
    </div>
  );
}

export default CrawlTargetPanel;
