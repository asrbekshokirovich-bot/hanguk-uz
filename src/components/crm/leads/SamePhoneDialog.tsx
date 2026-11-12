import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { Lead } from '@/contexts/LeadsContext';

interface SamePhoneDialogProps {
  /** The leads that already have the number; empty — closed. */
  matches: Lead[];
  busy: boolean;
  /** Write what was typed into this record instead of making a new one. */
  onFill: (lead: Lead) => void;
  /** Two people can share a phone: make the new record all the same. */
  onCreateAnyway: () => void;
  onCancel: () => void;
}

/**
 * Asked before a hand-made lead is saved with a number another lead already
 * has (see `samePhone`). It names the record — who, from where, since when,
 * what the last call came to — so the operator can tell their own caller
 * from a sibling on the family phone.
 */
export function SamePhoneDialog({ matches, busy, onFill, onCreateAnyway, onCancel }: SamePhoneDialogProps) {
  const { t } = useTranslation();
  // "11-noyabr", in Tashkent's day and with the month names the list uses —
  // a browser without Uzbek month names would print "M11".
  const months = t('leads.intake.months', { returnObjects: true }) as string[];
  const day = (iso: string) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'numeric' })
      .formatToParts(new Date(iso));
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return t('leads.intake.dayOfMonth', { day: part('day'), month: months[part('month') - 1] });
  };

  return (
    <AlertDialog open={matches.length > 0} onOpenChange={(open) => !open && !busy && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('leads.samePhone.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('leads.samePhone.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* min-w-0: a grid item is as wide as its longest line unless told otherwise,
            and a long name would push the dialog off a phone's screen. */}
        <ul className="min-w-0 space-y-2">
          {matches.map((lead) => (
            <li
              key={lead.id}
              className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{lead.full_name}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {[
                    lead.contact_channel || lead.source,
                    day(lead.created_at),
                    lead.call_result || t('leads.samePhone.notCalled'),
                  ].join(' · ')}
                </p>
              </div>
              <Button size="sm" className="w-full shrink-0 sm:w-auto" disabled={busy} onClick={() => onFill(lead)}>
                {t('leads.samePhone.fill')}
              </Button>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
          <Button variant="outline" disabled={busy} onClick={onCreateAnyway}>
            {t('leads.samePhone.createAnyway')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
