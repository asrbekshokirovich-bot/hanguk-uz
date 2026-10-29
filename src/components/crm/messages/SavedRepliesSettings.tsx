import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSavedReplies, type SavedReplyRow } from './useSavedReplies';

interface Draft {
  id: string | null;
  key: string;
  title: string;
  body: string;
  sort_order: number;
  active: boolean;
}

const EMPTY: Draft = { id: null, key: '/', title: '', body: '', sort_order: 100, active: true };

/**
 * Settings → Tayyor javoblar. Owners and admins edit (RLS enforces it);
 * everyone else sees the list read-only.
 */
export function SavedRepliesSettings({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { replies, loading, reload } = useSavedReplies({ includeInactive: true });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SavedReplyRow | null>(null);

  const keyValid = (k: string) => /^\/[a-z0-9_-]{1,24}$/.test(k);

  const save = async () => {
    if (!draft) return;
    const key = draft.key.trim().toLowerCase();
    if (!keyValid(key)) {
      toast({ title: t('messages.savedRepliesSettings.badKey'), variant: 'destructive' });
      return;
    }
    if (!draft.title.trim() || !draft.body.trim()) {
      toast({ title: t('messages.savedRepliesSettings.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    const row = {
      key,
      title: draft.title.trim(),
      body: draft.body.trim(),
      sort_order: Number.isFinite(draft.sort_order) ? draft.sort_order : 100,
      active: draft.active,
    };
    const table = (supabase.from as any)('saved_replies');
    const { error } = draft.id ? await table.update(row).eq('id', draft.id) : await table.insert(row);
    setSaving(false);
    if (error) {
      toast({
        title: t('common.error'),
        description: error.code === '23505' ? t('messages.savedRepliesSettings.duplicate') : error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: t('messages.savedRepliesSettings.saved') });
    setDraft(null);
    void reload();
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await (supabase.from as any)('saved_replies').delete().eq('id', deleting.id);
    setDeleting(null);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      return;
    }
    void reload();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('messages.savedRepliesSettings.hint')}</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {replies.map((r) => (
            <li key={r.id} className="flex items-start gap-3 p-3">
              <span className="mt-0.5 shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                {r.key}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {r.title}
                  {!r.active && (
                    <span className="ml-2 rounded-pill bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {t('messages.savedRepliesSettings.inactive')}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-muted-foreground">{r.body}</p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDraft({ ...r })}
                    aria-label={t('messages.savedRepliesSettings.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleting(r)}
                    aria-label={t('messages.savedRepliesSettings.delete')}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </li>
          ))}
          {replies.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">{t('messages.composer.noSavedReplies')}</li>
          )}
        </ul>
      )}

      {canEdit && !draft && (
        <Button variant="outline" onClick={() => setDraft({ ...EMPTY })} className="gap-1.5">
          <Plus className="h-4 w-4" /> {t('messages.savedRepliesSettings.add')}
        </Button>
      )}

      {canEdit && draft && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-[140px_1fr_100px]">
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              {t('messages.savedRepliesSettings.key')}
              <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="/docs" />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              {t('messages.savedRepliesSettings.title')}
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              {t('messages.savedRepliesSettings.order')}
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="block space-y-1 text-xs font-semibold text-muted-foreground">
            {t('messages.savedRepliesSettings.body')}
            <Textarea rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
          <p className="text-[11.5px] text-muted-foreground">{t('messages.savedRepliesSettings.variables', { ism: '{{ism}}', interpolation: { escapeValue: false } })}</p>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
              {t('messages.savedRepliesSettings.activeLabel')}
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.savedRepliesSettings.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.key} — {deleting?.title}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>{t('messages.savedRepliesSettings.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
