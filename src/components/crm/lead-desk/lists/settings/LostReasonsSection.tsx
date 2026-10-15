import { useRef } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LeadSettings, LostReasonSetting } from '../../types';
import { fieldClass } from '../FilterControls';
import { queueLabel, QUEUE_ORDER } from '../labels';
import { buildLostReasons, validateLostReasons } from '../settingsModel';
import { SectionShell, TextField } from './SectionShell';
import { useSettingsSection } from './useSettingsSection';

interface Row extends LostReasonSetting {
  uid: string;
}
interface Form {
  rows: Row[];
}

const toForm = (list: LostReasonSetting[]): Form => ({ rows: list.map((r) => ({ ...r, uid: r.key })) });
const strip = ({ uid: _uid, ...r }: Row): LostReasonSetting => r;

/**
 * Yo'qotish sabablari (spec §8): the closed list an operator picks from when a
 * lead is lost, and which reactivation queue each reason feeds.
 */
export default function LostReasonsSection({ settings }: { settings: LeadSettings }) {
  const s = useSettingsSection<Form>({
    id: 'lost_reasons',
    server: toForm(settings.lost_reasons),
    build: (f) => ({ lost_reasons: buildLostReasons(f.rows.map(strip)) }),
    validate: (f) => validateLostReasons(f.rows.map(strip)),
  });
  const savedKeys = new Set(settings.lost_reasons.map((r) => r.key));
  const counter = useRef(0);
  const rows = s.draft.rows;

  const update = (uid: string, patch: Partial<LostReasonSetting>) =>
    s.setDraft((d) => ({ rows: d.rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)) }));

  const move = (i: number, by: -1 | 1) =>
    s.setDraft((d) => {
      const next = [...d.rows];
      const j = i + by;
      if (j < 0 || j >= next.length) return d;
      [next[i], next[j]] = [next[j], next[i]];
      return { rows: next };
    });

  const add = () => {
    counter.current += 1;
    s.setDraft((d) => ({ rows: [...d.rows, { uid: `new-${counter.current}`, key: '', label: '', queue: null }] }));
  };

  const queueKeys = [...new Set([...QUEUE_ORDER, ...rows.map((r) => r.queue).filter((q): q is string => Boolean(q))])];

  return (
    <SectionShell
      id="lost_reasons"
      title="Yo'qotish sabablari"
      description="Lid yo'qotilganda operator shu ro'yxatdan tanlaydi; «Navbat» — sabab qaysi qayta faollashtirish navbatiga tushishi. Eski sabab olib tashlansa, mavjud lidlarda u o'z kaliti bilan qoladi."
      section={s}
      actions={
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Yangi sabab
        </Button>
      }
    >
      <ul className="space-y-2">
        {rows.map((r, i) => {
          const saved = savedKeys.has(r.key) && r.uid === r.key;
          return (
            <li key={r.uid} className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-2.5">
              <TextField
                label="Kalit"
                value={r.key}
                disabled={saved}
                onChange={(key) => update(r.uid, { key: key.trim().toLowerCase() })}
                className="w-44"
                inputClassName={cn('font-mono', saved && 'bg-muted')}
              />
              <TextField label="Nomi" value={r.label} onChange={(label) => update(r.uid, { label })} className="w-60" />
              <label className="flex flex-col gap-1 text-[13px] font-medium">
                Navbat
                <select
                  className={`${fieldClass} h-9 w-64 font-normal`}
                  value={r.queue ?? ''}
                  onChange={(e) => update(r.uid, { queue: e.target.value || null })}
                >
                  <option value="">Navbatsiz (qaytmaydi)</option>
                  {queueKeys.map((q) => (
                    <option key={q} value={q}>
                      {queueLabel(q)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ml-auto flex items-center gap-0.5">
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Yuqoriga: ${r.label || r.key}`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label={`Pastga: ${r.label || r.key}`}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label={`Sababni o'chirish: ${r.label || r.key}`}
                  onClick={() => s.setDraft((d) => ({ rows: d.rows.filter((x) => x.uid !== r.uid) }))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
