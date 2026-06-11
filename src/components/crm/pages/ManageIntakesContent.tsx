import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Leaf, Check, Plus, Star, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useActiveIntake, type Intake } from '@/contexts/IntakeContext';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Manage intakes — list every season by year, switch the active one, and
 * (owner/admin only) open/close a season, set the default landing intake, and
 * create next year's Spring/Fall. All writes go through the `intakes` RLS
 * policy; the IntakeContext re-reads via the ['intakes'] query on invalidate.
 */
export default function ManageIntakesContent() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { intakes, activeIntakeId, setActiveIntakeId, isLoading } = useActiveIntake();
  const { isAdmin } = useUserRole();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['intakes'] });

  const toggleOpen = async (intake: Intake) => {
    setBusyId(intake.id);
    const { error } = await supabase.from('intakes').update({ is_open: !intake.is_open }).eq('id', intake.id);
    setBusyId(null);
    if (error) return void toast.error(error.message);
    toast.success(t('intake.updatedToast'));
    refresh();
  };

  const makeDefault = async (intake: Intake) => {
    if (intake.is_default) return;
    setBusyId(intake.id);
    // Unset the current default first — a partial unique index allows only one.
    const { error: unsetErr } = await supabase.from('intakes').update({ is_default: false }).eq('is_default', true);
    if (unsetErr) {
      setBusyId(null);
      return void toast.error(unsetErr.message);
    }
    const { error } = await supabase.from('intakes').update({ is_default: true }).eq('id', intake.id);
    setBusyId(null);
    if (error) return void toast.error(error.message);
    toast.success(t('intake.updatedToast'));
    refresh();
  };

  const nextYear = (intakes.length ? Math.max(...intakes.map((i) => i.year)) : new Date().getFullYear()) + 1;

  const createNextYear = async () => {
    setCreating(true);
    const { error } = await supabase.from('intakes').upsert(
      [
        { season: 'spring', year: nextYear, is_open: false, is_default: false },
        { season: 'fall', year: nextYear, is_open: false, is_default: false },
      ],
      { onConflict: 'season,year', ignoreDuplicates: true },
    );
    setCreating(false);
    if (error) return void toast.error(error.message);
    toast.success(t('intake.createdToast'));
    refresh();
  };

  const years = [...new Set(intakes.map((i) => i.year))].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('intake.manage')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('intake.banner.subtitle')}</p>
        </div>
        {isAdmin ? (
          <Button onClick={createNextYear} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t('intake.createNextYear', { year: nextYear })}
          </Button>
        ) : null}
      </div>

      {!isAdmin ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t('intake.manageOnlyAdmins')}
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <div key={year} className="space-y-2">
              <h2 className="font-mono text-sm font-bold text-muted-foreground">{year}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['spring', 'fall'] as const).map((season) => {
                  const intake = intakes.find((i) => i.season === season && i.year === year);
                  if (!intake) return null;
                  const isSpring = season === 'spring';
                  const on = intake.id === activeIntakeId;
                  const Icon = isSpring ? Sun : Leaf;
                  const busy = busyId === intake.id;
                  return (
                    <div
                      key={intake.id}
                      className={cn(
                        'rounded-xl border p-4',
                        on ? 'border-primary ring-1 ring-primary' : 'border-border',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                            isSpring ? 'bg-spring/15 text-spring' : 'bg-fall/15 text-fall',
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground">
                            {t(`intake.season.${season}`)} {year}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant={intake.is_open ? 'successSoft' : 'neutral'}>
                              {t(intake.is_open ? 'intake.status.open' : 'intake.status.planning')}
                            </Badge>
                            {intake.is_default ? <Badge variant="info">{t('intake.default')}</Badge> : null}
                            {on ? <Badge variant="highlight">{t('intake.active')}</Badge> : null}
                          </div>
                        </div>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {!on ? (
                          <Button variant="outline" size="sm" onClick={() => setActiveIntakeId(intake.id)}>
                            <Check className="h-3.5 w-3.5" /> {t('intake.makeActive')}
                          </Button>
                        ) : null}
                        {isAdmin ? (
                          <>
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => toggleOpen(intake)}>
                              {intake.is_open ? t('intake.closeAction') : t('intake.openAction')}
                            </Button>
                            {!intake.is_default ? (
                              <Button variant="outline" size="sm" disabled={busy} onClick={() => makeDefault(intake)}>
                                <Star className="h-3.5 w-3.5" /> {t('intake.setDefault')}
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
