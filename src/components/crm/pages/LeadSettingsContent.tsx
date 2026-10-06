import { useCallback, useMemo, useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchSettings } from '@/components/crm/lead-desk/api';
import type { LeadSettings } from '@/components/crm/lead-desk/types';
import { DEFAULT_SETTINGS } from '@/components/crm/lead-desk/useLeadSettings';
import { PageHeader } from '@/components/crm/lead-desk/lists/FilterControls';
import { explainLeadError } from '@/components/crm/lead-desk/lists/labels';
import LadderSection from '@/components/crm/lead-desk/lists/settings/LadderSection';
import LostReasonsSection from '@/components/crm/lead-desk/lists/settings/LostReasonsSection';
import OffersSection from '@/components/crm/lead-desk/lists/settings/OffersSection';
import RecipientsSection from '@/components/crm/lead-desk/lists/settings/RecipientsSection';
import {
  AnnounceSection,
  HoursSection,
  PhoneRuleSection,
  QueueLimitSection,
  SwitchesSection,
  TimerSection,
} from '@/components/crm/lead-desk/lists/settings/SimpleSections';
import TemplatesSection from '@/components/crm/lead-desk/lists/settings/TemplatesSection';
import { AutoReplySection, BossWordsSection, ForbiddenWordsSection } from '@/components/crm/lead-desk/lists/settings/TextSections';
import { SettingsContext } from '@/components/crm/lead-desk/lists/settings/useSettingsSection';
import { cn } from '@/lib/utils';

interface SectionDef {
  id: string;
  title: string;
  /** the boss only; a lead_senior sees just the templates */
  adminOnly: boolean;
  Component: ComponentType<{ settings: LeadSettings }>;
}

const SECTIONS: SectionDef[] = [
  { id: 'hours', title: 'Ish vaqti', adminOnly: true, Component: HoursSection },
  { id: 'timer', title: 'Taymer va eskalatsiya', adminOnly: true, Component: TimerSection },
  { id: 'ladder', title: 'Zinapoya', adminOnly: true, Component: LadderSection },
  { id: 'auto_reply', title: 'Avtojavob matni', adminOnly: true, Component: AutoReplySection },
  { id: 'templates', title: 'Shablonlar', adminOnly: false, Component: TemplatesSection },
  { id: 'forbidden', title: "Taqiqlangan so'zlar", adminOnly: true, Component: ForbiddenWordsSection },
  { id: 'boss_words', title: "Rahbarga darhol so'zlar", adminOnly: true, Component: BossWordsSection },
  { id: 'offers', title: 'Ruxsat etilgan takliflar', adminOnly: true, Component: OffersSection },
  { id: 'lost_reasons', title: "Yo'qotish sabablari", adminOnly: true, Component: LostReasonsSection },
  { id: 'queue_limit', title: 'Navbat kunlik limiti', adminOnly: true, Component: QueueLimitSection },
  { id: 'announce', title: "Hanbox va NO RISK e'lonlari", adminOnly: true, Component: AnnounceSection },
  { id: 'phone_rule', title: "Chat javobi telefonli lidni to'xtatadimi", adminOnly: true, Component: PhoneRuleSection },
  { id: 'switches', title: "Nazorat chizig'i va TV", adminOnly: true, Component: SwitchesSection },
  { id: 'recipients', title: 'Telegram qabul qiluvchilar', adminOnly: true, Component: () => <RecipientsSection /> },
];

/**
 * Sozlamalar (spec §3.7). The boss (owner / admin) edits everything; a
 * lead_senior only the templates — the database says the same, so the other
 * sections are not even shown to them. Every section keeps its own draft and
 * saves with `saveSetting`; the left list marks sections with unsaved edits.
 */
export default function LeadSettingsContent() {
  const { isAdmin, isLeadSenior, loading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const raw = useQuery({ queryKey: ['lead-v2', 'settings', 'editor'], queryFn: fetchSettings, enabled: isLeadSenior });

  const [active, setActive] = useState('hours');
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const report = useCallback((id: string, isDirty: boolean) => setDirty((prev) => (Boolean(prev[id]) === isDirty ? prev : { ...prev, [id]: isDirty })), []);
  const ctx = useMemo(() => ({ userId: user?.id ?? null, report }), [user?.id, report]);

  // merged over the defaults only once the real values are in: a failed read must never
  // let the page save "defaults + my edit" over the real settings
  const settings = useMemo<LeadSettings | null>(() => (raw.data ? { ...DEFAULT_SETTINGS, ...raw.data } : null), [raw.data]);

  if (roleLoading) return <Skeleton className="h-40 w-full" />;
  if (!isLeadSenior) {
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md rounded-md border bg-muted/40 px-4 py-6 text-center text-sm">
        Sozlamalar faqat rahbar (admin) uchun.
      </div>
    );
  }

  const visible = SECTIONS.filter((s) => isAdmin || !s.adminOnly);
  const current = visible.some((s) => s.id === active) ? active : visible[0].id;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Sozlamalar"
        description={
          isAdmin
            ? "Lid bo'limining qoidalari. O'zgarishlar «Saqlash» bosilgandan keyin hammaga ta'sir qiladi."
            : "Siz senior sifatida faqat shablonlarni tahrirlay olasiz; qolgan sozlamalarni rahbar o'zgartiradi."
        }
      />

      <div className="grid grid-cols-[15rem_minmax(0,1fr)] items-start gap-4">
        <nav aria-label="Sozlamalar bo'limlari" className="sticky top-2 space-y-0.5 rounded-md border bg-background p-1.5">
          {visible.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={current === s.id ? 'page' : undefined}
              onClick={() => setActive(s.id)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-muted',
                current === s.id && 'bg-accent/15 font-semibold',
              )}
            >
              <span>{s.title}</span>
              {dirty[s.id] && <span className="h-2 w-2 shrink-0 rounded-full bg-warning" role="img" aria-label="Saqlanmagan o'zgarishlar" />}
            </button>
          ))}
        </nav>

        <SettingsContext.Provider value={ctx}>
          <div className="min-w-0">
            {raw.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : raw.error || !settings ? (
              <div role="alert" className="flex flex-col items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-10 text-center">
                <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
                <p className="text-sm font-medium">Sozlamalarni yuklab bo'lmadi</p>
                <p className="max-w-lg text-[13px] text-muted-foreground">
                  {explainLeadError(raw.error)}. Saqlash o'chirilgan: haqiqiy qiymatlarni ko'rmasdan ustidan yozib yubormaslik uchun.
                </p>
                <Button size="sm" variant="outline" onClick={() => void raw.refetch()}>
                  Qayta urinish
                </Button>
              </div>
            ) : (
              // every section stays mounted (only hidden) so a draft survives switching sections
              visible.map((s) => (
                <div key={s.id} hidden={s.id !== current}>
                  <s.Component settings={settings} />
                </div>
              ))
            )}
          </div>
        </SettingsContext.Provider>
      </div>
    </div>
  );
}
