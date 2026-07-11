import { useState } from 'react';
import { CalendarClock, Loader2, Sun, Leaf } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
 */

function seasonLabel(season: string): string {
  return season === 'spring' ? 'Spring' : 'Fall';
}

function intakeLabel(i: Intake): string {
  return `${seasonLabel(i.season)} ${i.year}`;
}

export function CrawlTargetPanel() {
  const qc = useQueryClient();
  const { intakes, isLoading } = useActiveIntake();
  const { isAdmin } = useUserRole();
  const [busy, setBusy] = useState(false);

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
    toast.success(`Crawl target set to ${picked ? intakeLabel(picked) : 'the selected semester'}`);
    qc.invalidateQueries({ queryKey: ['intakes'] });
  };

  const years = [...new Set(intakes.map((i) => i.year))].sort((a, b) => b - a);
  const TargetIcon = target?.season === 'spring' ? Sun : Leaf;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Auto-crawl target semester</div>
            <p className="text-xs text-muted-foreground">
              The nightly crawl looks for each university&rsquo;s guideline for this cycle. It
              tracks the default intake, so changing it here repoints the crawl.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : target ? (
                <Badge variant="info" className="gap-1">
                  <TargetIcon className="h-3.5 w-3.5" />
                  {intakeLabel(target)}
                  <span className="opacity-70">· {target.year}학년도</span>
                </Badge>
              ) : (
                <Badge variant="warning">No default intake set — crawl falls back to next year</Badge>
              )}
            </div>
          </div>
        </div>

        {isAdmin ? (
          <div className="flex items-center gap-2">
            <Select value={target?.id ?? ''} onValueChange={setDefault} disabled={busy || isLoading}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Choose target semester" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) =>
                  (['spring', 'fall'] as const).map((season) => {
                    const i = intakes.find((x) => x.season === season && x.year === year);
                    if (!i) return null;
                    return (
                      <SelectItem key={i.id} value={i.id}>
                        {intakeLabel(i)}
                        {i.is_open ? '' : ' · planning'}
                      </SelectItem>
                    );
                  }),
                )}
              </SelectContent>
            </Select>
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Only owners/admins can change this.</span>
        )}
      </CardContent>
    </Card>
  );
}

export default CrawlTargetPanel;
