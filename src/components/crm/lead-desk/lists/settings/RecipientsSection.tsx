import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteRecipient, fetchRecipients, saveRecipient } from '../../api';
import type { AlertRecipient } from '../../types';
import ConfirmDialog from '../ConfirmDialog';
import { fieldClass } from '../FilterControls';
import { explainLeadError } from '../labels';
import {
  buildRecipientPayload,
  emptyRecipient,
  recipientToForm,
  validateRecipient,
  type RecipientForm,
} from '../settingsModel';
import { useStaffNames } from '../useStaffNames';
import { FieldLabel, SwitchRow, TextField } from './SectionShell';

const tick = (on: boolean) =>
  on ? <Check className="mx-auto h-4 w-4 text-success" aria-label="Ha" /> : <span className="text-muted-foreground" aria-label="Yo'q">—</span>;

/**
 * Telegram qabul qiluvchilar (spec §4, §14): who gets escalations, boss
 * messages and the daily / weekly reports. Boss only (the table holds chat
 * ids; the database refuses everybody else).
 */
export default function RecipientsSection() {
  const qc = useQueryClient();
  const { staffList, nameOf } = useStaffNames();
  const recipients = useQuery({ queryKey: ['lead-v2', 'recipients'], queryFn: fetchRecipients });

  const [editor, setEditor] = useState<{ form: RecipientForm; isNew: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AlertRecipient | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const rows = recipients.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['lead-v2', 'recipients'] });

  const patch = (p: Partial<RecipientForm>) => setEditor((e) => (e ? { ...e, form: { ...e.form, ...p } } : e));

  const submit = async () => {
    if (!editor) return;
    const problem = validateRecipient(editor.form, rows.map((r) => r.chat_id), editor.isNew);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveRecipient(buildRecipientPayload(editor.form));
      toast.success('Qabul qiluvchi saqlandi');
      setEditor(null);
      await refresh();
    } catch (e) {
      setError(explainLeadError(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await deleteRecipient(removing.chat_id);
      toast.success("Qabul qiluvchi o'chirildi");
      setRemoving(null);
      await refresh();
    } catch (e) {
      setRemoveError(explainLeadError(e));
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <section aria-labelledby="sec-recipients" className="space-y-4 rounded-md border bg-background p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="sec-recipients" className="text-base font-semibold">
            Telegram qabul qiluvchilar
          </h2>
          <p className="mt-0.5 max-w-3xl text-[13px] text-muted-foreground">
            Har bir kishi HANGUK botiga Telegramda <strong>Start</strong> bosadi, keyin siz uning chat ID sini shu yerga qo'shasiz. Bot Start bosilmagan odamga xabar
            yubora olmaydi.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setError(null);
            setEditor({ form: { ...emptyRecipient }, isNew: true });
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Qo'shish
        </Button>
      </header>

      {recipients.isLoading ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">Yuklanmoqda…</p>
      ) : recipients.error ? (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[13px]">
          <span>{explainLeadError(recipients.error)}</span>
          <Button size="sm" variant="outline" onClick={() => void recipients.refetch()}>
            Qayta urinish
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Hali hech kim qo'shilmagan: eskalatsiya va hisobotlar Telegramga yuborilmaydi.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full min-w-[820px] text-[13px]" aria-label="Telegram qabul qiluvchilar">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  Nomi
                </th>
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  Chat ID
                </th>
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  Xodim
                </th>
                <th scope="col" className="px-2 py-1.5 text-center font-semibold">
                  Eskalatsiya
                </th>
                <th scope="col" className="px-2 py-1.5 text-center font-semibold">
                  Rahbar xabarlari
                </th>
                <th scope="col" className="px-2 py-1.5 text-center font-semibold">
                  Kunlik
                </th>
                <th scope="col" className="px-2 py-1.5 text-center font-semibold">
                  Haftalik
                </th>
                <th scope="col" className="px-2 py-1.5 text-center font-semibold">
                  Yoqilgan
                </th>
                <th scope="col" className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.chat_id} className="border-t">
                  <th scope="row" className="px-2 py-1.5 text-left font-medium">
                    {r.label || '—'}
                  </th>
                  <td className="px-2 py-1.5 font-mono text-[12px]">{r.chat_id}</td>
                  <td className="px-2 py-1.5">{nameOf(r.staff_user_id) ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-1.5 text-center">{tick(r.escalate)}</td>
                  <td className="px-2 py-1.5 text-center">{tick(r.boss_alerts)}</td>
                  <td className="px-2 py-1.5 text-center">{tick(r.reports_daily)}</td>
                  <td className="px-2 py-1.5 text-center">{tick(r.reports_weekly)}</td>
                  <td className="px-2 py-1.5 text-center">{tick(r.enabled)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={`Tahrirlash: ${r.label || r.chat_id}`}
                      onClick={() => {
                        setError(null);
                        setEditor({ form: recipientToForm(r), isNew: false });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      aria-label={`O'chirish: ${r.label || r.chat_id}`}
                      onClick={() => {
                        setRemoveError(null);
                        setRemoving(r);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editor != null} onOpenChange={(o) => !o && !saving && setEditor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.isNew ? "Qabul qiluvchi qo'shish" : 'Qabul qiluvchini tahrirlash'}</DialogTitle>
            <DialogDescription>Telegram chat ID, nomi va nimalarni olishi.</DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-3">
              <TextField
                label="Chat ID"
                value={editor.form.chat_id}
                onChange={(chat_id) => patch({ chat_id })}
                disabled={!editor.isNew}
                inputMode="numeric"
                hint={editor.isNew ? "Raqam (guruhniki minus bilan boshlanadi)" : "Chat ID o'zgarmaydi; boshqasi kerak bo'lsa, o'chirib qayta qo'shing"}
                inputClassName="font-mono"
              />
              <TextField label="Nomi" value={editor.form.label} onChange={(label) => patch({ label })} placeholder="Masalan: Omina (operator)" />
              <FieldLabel label="Xodim (ixtiyoriy)">
                <select className={`${fieldClass} h-9 font-normal`} value={editor.form.staff_user_id} onChange={(e) => patch({ staff_user_id: e.target.value })}>
                  <option value="">Bog'lanmagan</option>
                  {staffList.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <div className="space-y-2.5 border-t pt-3">
                <SwitchRow label="Eskalatsiya" hint="10 daqiqada javobsiz lid" checked={editor.form.escalate} onChange={(escalate) => patch({ escalate })} />
                <SwitchRow
                  label="Rahbar xabarlari"
                  hint="Chegirma so'rovi, «direktor» so'zi, shartnoma va to'lov"
                  checked={editor.form.boss_alerts}
                  onChange={(boss_alerts) => patch({ boss_alerts })}
                />
                <SwitchRow label="Kunlik hisobot" hint="Har kuni 09:30" checked={editor.form.reports_daily} onChange={(reports_daily) => patch({ reports_daily })} />
                <SwitchRow label="Haftalik hisobot" hint="Dushanba 09:30" checked={editor.form.reports_weekly} onChange={(reports_weekly) => patch({ reports_weekly })} />
                <SwitchRow label="Yoqilgan" hint="O'chirib qo'yilsa hech narsa yuborilmaydi" checked={editor.form.enabled} onChange={(enabled) => patch({ enabled })} />
              </div>
              {error && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)} disabled={saving}>
              Bekor qilish
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? 'Saqlanmoqda…' : 'Saqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing != null}
        title="Qabul qiluvchini o'chirish"
        description={removing ? `${removing.label || removing.chat_id} (${removing.chat_id}) endi Telegramdan xabar olmaydi.` : undefined}
        confirmLabel="O'chirish"
        destructive
        busy={removeBusy}
        error={removeError}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
