import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cctv, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import {
  fmtLogTime,
  nextSort,
  normalizeCameraId,
  parseSort,
  validateName,
  validateNewCamera,
  type CameraLogRow,
  type CameraRow,
} from '@/lib/cameraSettings';

// cameras va camera_access_log hali generatsiya qilingan Database turlarida yo'q
// (migratsiya 20261103120000_cameras.sql).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as unknown as { from: (n: string) => any };

interface Draft {
  name: string;
  sort: string;
}

/** Owner: kameralar ro'yxati (nom, tartib, yoqilgan) va ko'rish jurnali. */
export function CameraSettingsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [rows, setRows] = useState<CameraRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [log, setLog] = useState<CameraLogRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [toDelete, setToDelete] = useState<CameraRow | null>(null);

  const fail = useCallback(
    (message: string) => toast({ title: t('crm.cameras.settings.saveFailed'), description: message, variant: 'destructive' }),
    [t, toast],
  );

  const load = useCallback(async () => {
    const [{ data: cams, error: cErr }, { data: entries, error: lErr }] = await Promise.all([
      sb.from('cameras').select('id, name, sort, enabled').order('sort').order('name'),
      sb.from('camera_access_log').select('id, user_id, camera_ids, ip, created_at').order('created_at', { ascending: false }).limit(30),
    ]);
    if (cErr) fail(cErr.message);
    const list = (cams ?? []) as CameraRow[];
    setRows(list);
    setDrafts(Object.fromEntries(list.map((r) => [r.id, { name: r.name, sort: String(r.sort) }])));
    const logRows = (lErr ? [] : entries ?? []) as CameraLogRow[];
    setLog(logRows);
    const ids = [...new Set(logRows.map((r) => r.user_id).filter((x): x is string => Boolean(x)))];
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
      setNames(Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.full_name ?? '—'])));
    }
    setLoading(false);
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const id = normalizeCameraId(newId);
    const problem = validateNewCamera(id, newName, rows.map((r) => r.id));
    if (problem) {
      toast({ title: t(`crm.cameras.settings.${problem}`), variant: 'destructive' });
      return;
    }
    setBusy('new');
    const { error } = await sb.from('cameras').insert({ id, name: newName.trim(), sort: nextSort(rows) });
    setBusy(null);
    if (error) return fail(error.message);
    setNewId('');
    setNewName('');
    toast({ title: t('crm.cameras.settings.saved') });
    void load();
  };

  const save = async (row: CameraRow) => {
    const d = drafts[row.id];
    const sort = parseSort(d.sort);
    const problem = validateName(d.name) ?? (sort === null ? 'invalidSort' : null);
    if (problem) {
      toast({ title: t(`crm.cameras.settings.${problem}`), variant: 'destructive' });
      return;
    }
    setBusy(row.id);
    const { error } = await sb.from('cameras').update({ name: d.name.trim(), sort }).eq('id', row.id);
    setBusy(null);
    if (error) return fail(error.message);
    toast({ title: t('crm.cameras.settings.saved') });
    void load();
  };

  const setEnabled = async (row: CameraRow, enabled: boolean) => {
    setBusy(row.id);
    const { error } = await sb.from('cameras').update({ enabled }).eq('id', row.id);
    setBusy(null);
    if (error) return fail(error.message);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled } : r)));
  };

  const remove = async (row: CameraRow) => {
    setBusy(row.id);
    const { error } = await sb.from('cameras').delete().eq('id', row.id);
    setBusy(null);
    setToDelete(null);
    if (error) return fail(error.message);
    toast({ title: t('crm.cameras.settings.deleted') });
    void load();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cctv className="h-5 w-5" /> {t('crm.cameras.settings.title')}
        </CardTitle>
        <CardDescription>{t('crm.cameras.settings.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('crm.cameras.settings.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('crm.cameras.settings.id')}</TableHead>
                  <TableHead>{t('crm.cameras.settings.name')}</TableHead>
                  <TableHead className="w-24">{t('crm.cameras.settings.sort')}</TableHead>
                  <TableHead className="w-24">{t('crm.cameras.settings.enabled')}</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const d = drafts[row.id] ?? { name: row.name, sort: String(row.sort) };
                  const dirty = d.name !== row.name || d.sort !== String(row.sort);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      <TableCell className="min-w-40">
                        <Input
                          value={d.name}
                          maxLength={60}
                          onChange={(e) => setDrafts((p) => ({ ...p, [row.id]: { ...d, name: e.target.value } }))}
                          aria-label={t('crm.cameras.settings.name')}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={d.sort}
                          inputMode="numeric"
                          onChange={(e) => setDrafts((p) => ({ ...p, [row.id]: { ...d, sort: e.target.value } }))}
                          aria-label={t('crm.cameras.settings.sort')}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={row.enabled}
                          disabled={busy === row.id}
                          onCheckedChange={(v) => void setEnabled(row, v)}
                          aria-label={t('crm.cameras.settings.enabled')}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={!dirty || busy === row.id}
                            onClick={() => void save(row)}
                            aria-label={t('crm.cameras.settings.save')}
                            title={t('crm.cameras.settings.save')}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            disabled={busy === row.id}
                            onClick={() => setToDelete(row)}
                            aria-label={t('crm.cameras.settings.delete')}
                            title={t('crm.cameras.settings.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="camera-new-id" className="text-xs text-muted-foreground">
              {t('crm.cameras.settings.id')}
            </Label>
            <Input
              id="camera-new-id"
              value={newId}
              placeholder="kirish"
              className="font-mono"
              maxLength={32}
              onChange={(e) => setNewId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="camera-new-name" className="text-xs text-muted-foreground">
              {t('crm.cameras.settings.name')}
            </Label>
            <Input
              id="camera-new-name"
              value={newName}
              placeholder={t('crm.cameras.settings.namePlaceholder')}
              maxLength={60}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <Button onClick={() => void add()} disabled={busy === 'new'} className="gap-1.5">
            <Plus className="h-4 w-4" /> {t('crm.cameras.settings.add')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('crm.cameras.settings.idHint')}</p>

        <Separator />

        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold">{t('crm.cameras.settings.log')}</h3>
            <p className="text-xs text-muted-foreground">{t('crm.cameras.settings.logHint')}</p>
          </div>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('crm.cameras.settings.logEmpty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">{t('crm.cameras.settings.logWhen')}</TableHead>
                    <TableHead>{t('crm.cameras.settings.logWho')}</TableHead>
                    <TableHead>{t('crm.cameras.settings.logCameras')}</TableHead>
                    <TableHead className="w-32">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">{fmtLogTime(r.created_at)}</TableCell>
                      <TableCell>{r.user_id ? names[r.user_id] ?? '—' : t('crm.cameras.settings.logDeleted')}</TableCell>
                      <TableCell className="text-muted-foreground">{r.camera_ids.join(', ')}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.ip ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog open={toDelete !== null} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('crm.cameras.settings.deleteTitle', { name: toDelete?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('crm.cameras.settings.deleteText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('crm.cameras.settings.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && void remove(toDelete)}
            >
              {t('crm.cameras.settings.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
