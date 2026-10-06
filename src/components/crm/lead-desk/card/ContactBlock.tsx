/**
 * Block 3 "Aloqa" (spec §5.4, §5.3): the student's own contact details, all
 * editable inline, and the parent / payer block backed by `lead_contacts`.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, Phone, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { deleteContact, saveContact } from '../api';
import { explainError } from '../copy';
import type { LeadContact, LeadV2 } from '../types';
import { cleanHandle, cleanPhone } from './leadWrite';
import { InlineText } from './InlineText';
import { copyToClipboard, isDialable, telHref } from './phone';
import { ChipGroup, ConfirmButton, FieldLabel, IconButton, Section, inputCls } from './ui';
import { useContacts } from './useCardData';

interface ContactBlockProps {
  lead: LeadV2;
  disabled: boolean;
  saveField: (patch: Record<string, unknown>) => Promise<boolean>;
  /** a phone save: the card follows up when the number merged this card into an older one */
  savePhone: (patch: { phone: string | null }) => Promise<boolean>;
}

const PREFERRED_CHANNELS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'phone', label: 'Telefon' },
];

const LANGUAGES = [
  { value: 'uz', label: "O'zbekcha" },
  { value: 'ru', label: 'Ruscha' },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <IconButton
      label={label}
      onClick={async () => {
        if (await copyToClipboard(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } else {
          toast.error('Nusxalab bo‘lmadi');
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
    </IconButton>
  );
}

export function ContactBlock({ lead, disabled, saveField, savePhone }: ContactBlockProps) {
  const contacts = useContacts(lead.id);
  const [adding, setAdding] = useState(false);
  const list = (contacts.data ?? []).filter((c) => c.role !== 'student');

  return (
    <Section title="Aloqa">
      <div className="space-y-3">
        <div className="space-y-0.5">
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Talaba</h4>
          <InlineText
            label="Telefon"
            type="tel"
            value={lead.phone}
            placeholder="Telefon qo‘shish"
            disabled={disabled}
            onSave={(v) => savePhone({ phone: cleanPhone(v) })}
            actions={
              lead.phone ? (
                <>
                  <CopyButton text={lead.phone} label="Telefonni nusxalash" />
                  {isDialable(lead.phone) && (
                    <a
                      href={telHref(lead.phone)}
                      aria-label="Telefon qilish"
                      title="Telefon ilovasida ochish"
                      className="inline-flex h-7 w-7 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </>
              ) : null
            }
          />
          <InlineText
            label="Instagram"
            prefix="@"
            value={lead.instagram_handle}
            placeholder="@username"
            disabled={disabled}
            onSave={(v) => saveField({ instagram_handle: cleanHandle(v) })}
          />
          <InlineText
            label="Telegram"
            prefix="@"
            value={lead.telegram_handle}
            placeholder="@username"
            disabled={disabled}
            onSave={(v) => saveField({ telegram_handle: cleanHandle(v) })}
          />
          <InlineText
            label="Qulay vaqt"
            value={lead.preferred_time_text}
            placeholder="masalan: 18:00 dan keyin"
            disabled={disabled}
            onSave={(v) => saveField({ preferred_time_text: v.trim() === '' ? null : v.trim() })}
          />
          <div className="flex items-center gap-2 pt-1 text-[12.5px]">
            <span className="w-[6.5rem] shrink-0 font-semibold text-muted-foreground">Til</span>
            <ChipGroup<'uz' | 'ru'>
              label="Til"
              options={LANGUAGES as { value: 'uz' | 'ru'; label: string }[]}
              value={lead.language}
              onChange={(v) => saveField({ language: v })}
              allowClear
              disabled={disabled}
            />
          </div>
          <div className="flex items-center gap-2 pt-1 text-[12.5px]">
            <span className="w-[6.5rem] shrink-0 font-semibold text-muted-foreground">Qulay kanal</span>
            <ChipGroup
              label="Qulay kanal"
              options={PREFERRED_CHANNELS}
              value={lead.preferred_channel}
              onChange={(v) => saveField({ preferred_channel: v })}
              allowClear
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-2.5">
          <h4 className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Ota-ona / to'lovchi</h4>
          {list.length === 0 && !adding && (
            <p className="text-[12px] text-muted-foreground">Ota-ona yoki to'lovchi hali kiritilmagan.</p>
          )}
          {list.map((c) => (
            <ContactCard key={c.id} leadId={lead.id} contact={c} disabled={disabled} />
          ))}
          {adding && <ContactCard leadId={lead.id} contact={null} disabled={disabled} onDone={() => setAdding(false)} />}
          {!adding && !disabled && (
            <Button variant="outline" size="sm" className="h-8 min-h-0" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Ota-ona / qarindosh qo'shish
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}

interface ContactCardProps {
  leadId: string;
  contact: LeadContact | null;
  disabled: boolean;
  onDone?: () => void;
}

/** One parent / relative. An existing one saves each field when it loses focus; a new one on "Saqlash". */
function ContactCard({ leadId, contact, disabled, onDone }: ContactCardProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: contact?.name ?? '',
    phone: contact?.phone ?? '',
    relation: contact?.relation ?? '',
    preferred_time: contact?.preferred_time ?? '',
    role: (contact?.role ?? 'parent') as 'parent' | 'relative',
  });
  // follow the stored values (not the object: a refetch that changed nothing must not wipe what is being typed)
  const stored = contact ? [contact.name, contact.phone, contact.relation, contact.preferred_time].join('\u0001') : null;
  useEffect(() => {
    if (!contact) return;
    setForm((f) => ({
      ...f,
      name: contact.name ?? '',
      phone: contact.phone ?? '',
      relation: contact.relation ?? '',
      preferred_time: contact.preferred_time ?? '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ['lead-v2', 'contacts', leadId] });
  const fail = (e: unknown) => toast.error(explainError(e instanceof Error ? e.message : String(e)));

  const persist = async (patch: Partial<LeadContact>) => {
    try {
      await saveContact({ id: contact?.id, lead_id: leadId, ...patch });
      refresh();
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const commit = (field: 'name' | 'phone' | 'relation' | 'preferred_time') => {
    if (!contact) return;
    const next = form[field].trim();
    if (next === (contact[field] ?? '')) return;
    void persist({ [field]: next === '' ? null : next });
  };

  const field = (key: 'name' | 'phone' | 'relation' | 'preferred_time', label: string, type = 'text') => (
    <div>
      <FieldLabel htmlFor={`c-${contact?.id ?? 'new'}-${key}`}>{label}</FieldLabel>
      <input
        id={`c-${contact?.id ?? 'new'}-${key}`}
        type={type}
        value={form[key]}
        disabled={disabled}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        onBlur={() => commit(key)}
        className={inputCls}
      />
    </div>
  );

  const create = async () => {
    if (form.name.trim() === '' && form.phone.trim() === '') {
      toast.error('Ism yoki telefon raqamini kiriting');
      return;
    }
    const ok = await persist({
      role: form.role,
      name: form.name.trim() || null,
      phone: form.phone.trim() || null,
      relation: form.relation.trim() || null,
      preferred_time: form.preferred_time.trim() || null,
      is_decider: false,
    });
    if (ok) onDone?.();
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-2.5">
      {!contact && (
        <ChipGroup<'parent' | 'relative'>
          label="Kim"
          options={[
            { value: 'parent', label: 'Ota-ona' },
            { value: 'relative', label: 'Qarindosh' },
          ]}
          value={form.role}
          onChange={(v) => v && setForm((f) => ({ ...f, role: v }))}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        {field('name', 'Ism')}
        {field('phone', 'Telefon', 'tel')}
        {field('relation', "Qarindoshlik (ona, ota…)")}
        {field('preferred_time', 'Qulay vaqt')}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {contact ? (
          <label className="flex items-center gap-2 text-[12px] font-medium">
            <Switch
              aria-label="Qaror qiladi"
              checked={contact.is_decider}
              disabled={disabled}
              onCheckedChange={(v) => void persist({ is_decider: v })}
              className="h-5 min-h-0 w-9 min-w-0 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
            />
            qaror qiladi
          </label>
        ) : (
          <>
            <Button size="sm" className="h-8 min-h-0" onClick={create} disabled={disabled}>
              Saqlash
            </Button>
            <Button size="sm" variant="ghost" className="h-8 min-h-0" onClick={onDone}>
              Bekor qilish
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {contact && isDialable(contact.phone) && (
            <a
              href={telHref(contact.phone as string)}
              aria-label={`${contact.name ?? 'Ota-ona'}ga qo'ng'iroq`}
              className="inline-flex h-7 min-h-0 min-w-0 items-center gap-1 rounded-md border border-border px-2 text-[12px] font-semibold hover:bg-muted"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Qo'ng'iroq
            </a>
          )}
          {contact && !disabled && (
            <ConfirmButton
              label="Ota-onani o'chirish"
              confirmLabel="O'chirilsinmi?"
              onConfirm={async () => {
                try {
                  await deleteContact(contact.id);
                  refresh();
                } catch (e) {
                  fail(e);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </ConfirmButton>
          )}
        </div>
      </div>
    </div>
  );
}
