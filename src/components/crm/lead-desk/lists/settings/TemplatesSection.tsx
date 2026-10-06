import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { findForbidden } from '../../forbidden';
import type { LeadSettings, TemplateSetting } from '../../types';
import { fieldClass } from '../FilterControls';
import { PROTECTED_TEMPLATE_KEYS, TEMPLATE_GROUP_LABEL, TEMPLATE_VARIABLES, templateGroupLabel } from '../labels';
import { buildTemplates, groupTemplates, unknownVariables, validateTemplates } from '../settingsModel';
import { FieldLabel, SectionShell, SwitchRow, TextField } from './SectionShell';
import { useSettingsSection } from './useSettingsSection';

interface TemplateRow extends TemplateSetting {
  /** stable id for the row (the key for saved ones), so typing a key does not remount the editor */
  uid: string;
}

interface Form {
  rows: TemplateRow[];
}

const toForm = (list: TemplateSetting[]): Form => ({ rows: list.map((t) => ({ ...t, uid: t.key })) });
const strip = ({ uid: _uid, ...t }: TemplateRow): TemplateSetting => t;

type Lang = 'uz' | 'ru';

/**
 * Shablonlar (spec §10): uz / ru texts grouped by purpose. The only section a
 * lead_senior may edit (the database enforces it too).
 */
export default function TemplatesSection({ settings }: { settings: LeadSettings }) {
  const s = useSettingsSection<Form>({
    id: 'templates',
    server: toForm(settings.templates),
    build: (f) => ({ templates: buildTemplates(f.rows.map(strip)) }),
    validate: (f) => validateTemplates(f.rows.map(strip)),
  });
  const savedKeys = new Set(settings.templates.map((t) => t.key));
  const rows = s.draft.rows;

  const [open, setOpen] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<{ uid: string; lang: Lang } | null>(null);
  const counter = useRef(0);

  const toggleOpen = (uid: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const update = (uid: string, patch: Partial<TemplateSetting>) =>
    s.setDraft((d) => ({ rows: d.rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)) }));

  const add = () => {
    counter.current += 1;
    const uid = `new-${counter.current}`;
    const group = rows.length ? rows[rows.length - 1].group : 'salom';
    s.setDraft((d) => ({ rows: [...d.rows, { uid, key: '', group, uz: '', ru: '' }] }));
    setOpen((prev) => new Set(prev).add(uid));
  };

  const remove = (uid: string) => s.setDraft((d) => ({ rows: d.rows.filter((r) => r.uid !== uid) }));

  const insertVariable = (name: string) => {
    if (!focus) return;
    const row = rows.find((r) => r.uid === focus.uid);
    if (!row) return;
    const el = document.getElementById(`tpl-${focus.uid}-${focus.lang}`) as HTMLTextAreaElement | null;
    const text = row[focus.lang];
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    update(focus.uid, { [focus.lang]: text.slice(0, start) + name + text.slice(end) });
    const caret = start + name.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const groups = groupTemplates(rows);
  const knownGroups = [...new Set([...Object.keys(TEMPLATE_GROUP_LABEL), ...rows.map((r) => r.group)])];

  return (
    <SectionShell
      id="templates"
      title="Shablonlar"
      description="Operator yozish oynasida va izohga javobda shu matnlardan foydalanadi. Har shablonda o'zbekcha va ruscha variant bor."
      section={s}
      actions={
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Yangi shablon
        </Button>
      }
    >
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-[12px]">
        <div className="mb-1 font-medium">O'zgaruvchilar (yuborilganda mijoz ma'lumoti bilan almashadi)</div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {TEMPLATE_VARIABLES.map((v) => (
            <li key={v.name} className="flex items-center gap-1">
              <button
                type="button"
                className="rounded border bg-background px-1.5 font-mono hover:bg-muted disabled:opacity-50"
                onClick={() => insertVariable(v.name)}
                disabled={!focus}
                title={focus ? 'Kursor turgan joyga qo\'shish' : 'Avval matn maydonini bosing'}
              >
                {v.name}
              </button>
              <span className="text-muted-foreground">{v.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {rows.length === 0 && <p className="py-4 text-center text-[13px] text-muted-foreground">Shablon yo'q. «Yangi shablon» tugmasi bilan qo'shing.</p>}

      {groups.map(({ group, items }) => (
        <div key={group} className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{templateGroupLabel(group) || 'Guruhsiz'}</h3>
          <ul className="divide-y rounded-md border">
            {items.map((r) => {
              const isOpen = open.has(r.uid);
              const protectedKey = PROTECTED_TEMPLATE_KEYS.includes(r.key);
              const saved = savedKeys.has(r.key) && r.uid === r.key;
              const bad = [...unknownVariables(r.uz), ...unknownVariables(r.ru)];
              return (
                <li key={r.uid}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`tpl-body-${r.uid}`}
                    onClick={() => toggleOpen(r.uid)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-muted/50"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    <span className="w-40 shrink-0 truncate font-mono text-[12px]">{r.key || '(yangi)'}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.uz || '—'}</span>
                    {r.needs_boss && <span className="shrink-0 rounded-full bg-warning/10 px-2 text-[11px] text-warning">Rahbar tasdig'i</span>}
                    {bad.length > 0 && <span className="shrink-0 text-[11px] font-medium text-destructive">noma'lum o'zgaruvchi</span>}
                  </button>

                  {isOpen && (
                    <div id={`tpl-body-${r.uid}`} className="space-y-3 border-t bg-muted/20 px-3 py-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <TextField
                          label="Kalit"
                          value={r.key}
                          onChange={(key) => update(r.uid, { key: key.trim().toLowerCase() })}
                          className="w-52"
                          inputClassName={cn('font-mono', saved && 'bg-muted')}
                          hint={saved ? "Saqlangan shablon kaliti o'zgarmaydi" : 'kichik lotin harflari, raqam va _'}
                          disabled={saved}
                        />
                        <FieldLabel label="Guruh" className="w-52">
                          <input
                            list="template-groups"
                            value={r.group}
                            onChange={(e) => update(r.uid, { group: e.target.value })}
                            className={cn(fieldClass, 'h-9 font-normal')}
                          />
                        </FieldLabel>
                        <div className="min-w-[14rem] flex-1">
                          <SwitchRow
                            label="Rahbar tasdig'i kerak"
                            hint="NO RISK kabi shartlar"
                            checked={Boolean(r.needs_boss)}
                            onChange={(needs_boss) => update(r.uid, { needs_boss })}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {(['uz', 'ru'] as const).map((lang) => {
                          const forbidden = findForbidden(r[lang], settings.forbidden_words);
                          return (
                            <FieldLabel key={lang} label={lang === 'uz' ? "O'zbekcha" : 'Ruscha'}>
                              <Textarea
                                id={`tpl-${r.uid}-${lang}`}
                                aria-label={`${r.key || 'yangi'} ${lang === 'uz' ? "o'zbekcha" : 'ruscha'} matn`}
                                value={r[lang]}
                                rows={4}
                                onFocus={() => setFocus({ uid: r.uid, lang })}
                                onChange={(e) => update(r.uid, { [lang]: e.target.value })}
                                className="text-sm font-normal"
                              />
                              {forbidden && <span className="text-[12px] font-medium text-destructive">Taqiqlangan so'z: «{forbidden}»</span>}
                            </FieldLabel>
                          );
                        })}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={protectedKey}
                          title={protectedKey ? "Tizim shu kalit bilan qidiradi: o'chirib bo'lmaydi, matnini o'zgartirish mumkin" : undefined}
                          onClick={() => remove(r.uid)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          O'chirish
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <datalist id="template-groups">
        {knownGroups.map((g) => (
          <option key={g} value={g} label={templateGroupLabel(g)} />
        ))}
      </datalist>
    </SectionShell>
  );
}
