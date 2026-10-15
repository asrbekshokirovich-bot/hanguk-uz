import { useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { LeadSettings } from '../../types';
import { PROTECTED_OFFER_KEYS } from '../labels';
import { buildOffers, offersToForm, validateOffers, type OfferForm } from '../settingsModel';
import { FieldLabel, SectionShell, SwitchRow, TextField } from './SectionShell';
import { useSettingsSection } from './useSettingsSection';

interface OfferRow extends OfferForm {
  uid: string;
}
interface Form {
  rows: OfferRow[];
}

const toForm = (o: LeadSettings['offers']): Form => ({ rows: offersToForm(o).map((r) => ({ ...r, uid: r.key })) });
const strip = ({ uid: _uid, ...o }: OfferRow): OfferForm => o;

/** Where the boss still owes us a number (spec §11, open question Q65). */
const PRICE_FROM_BOSS = ['kasbiy', 'gks'];

/**
 * Ruxsat etilgan takliflar (spec §11): the offer card an operator may quote
 * from. Anything else (a discount, a special term) goes to the boss as a
 * promise.
 */
export default function OffersSection({ settings }: { settings: LeadSettings }) {
  const s = useSettingsSection<Form>({
    id: 'offers',
    server: toForm(settings.offers),
    build: (f) => ({ offers: buildOffers(f.rows.map(strip)) }),
    validate: (f) => validateOffers(f.rows.map(strip)),
  });
  const savedKeys = new Set(Object.keys(settings.offers));
  const counter = useRef(0);

  const update = (uid: string, patch: Partial<OfferForm>) =>
    s.setDraft((d) => ({ rows: d.rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)) }));

  const add = () => {
    counter.current += 1;
    s.setDraft((d) => ({ rows: [...d.rows, { uid: `new-${counter.current}`, key: '', title: '', text: '', needs_boss: false }] }));
  };

  return (
    <SectionShell
      id="offers"
      title="Ruxsat etilgan takliflar"
      description="Karta shu takliflarni mijoz holatiga qarab ko'rsatadi; operator faqat shu shartlarni aytadi. Boshqa chegirma va shartlar rahbar tasdig'iga boradi."
      section={s}
      actions={
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Yangi taklif
        </Button>
      }
    >
      {s.draft.rows.length === 0 && <p className="py-4 text-center text-[13px] text-muted-foreground">Taklif yo'q.</p>}
      <ul className="space-y-3">
        {s.draft.rows.map((r) => {
          const saved = savedKeys.has(r.key) && r.uid === r.key;
          const protectedKey = PROTECTED_OFFER_KEYS.includes(r.key);
          return (
            <li key={r.uid} className="space-y-2 rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <TextField
                  label="Kalit"
                  value={r.key}
                  disabled={saved}
                  onChange={(key) => update(r.uid, { key: key.trim().toLowerCase() })}
                  className="w-36"
                  inputClassName={cn('font-mono', saved && 'bg-muted')}
                />
                <TextField label="Nomi" value={r.title} onChange={(title) => update(r.uid, { title })} className="w-56" />
                <div className="min-w-[14rem] flex-1">
                  <SwitchRow
                    label="Rahbar tasdig'i bilan"
                    hint="Karta «Rahbar tasdig'i bilan» belgisini ko'rsatadi"
                    checked={r.needs_boss}
                    onChange={(needs_boss) => update(r.uid, { needs_boss })}
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  aria-label={`Taklifni o'chirish: ${r.key || 'yangi'}`}
                  disabled={protectedKey}
                  title={protectedKey ? "Karta va mos mahsulot qoidasi shu kalitni ishlatadi: o'chirib bo'lmaydi" : undefined}
                  onClick={() => s.setDraft((d) => ({ rows: d.rows.filter((x) => x.uid !== r.uid) }))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <FieldLabel
                label={`${r.title || r.key || 'Taklif'} — matn / shartlar`}
                hint={PRICE_FROM_BOSS.includes(r.key) ? 'Narx — rahbardan (ochiq savol): narx aniq bo\'lguncha shu so\'z qoladi.' : undefined}
              >
                <Textarea value={r.text} rows={2} onChange={(e) => update(r.uid, { text: e.target.value })} className="text-sm font-normal" />
              </FieldLabel>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
