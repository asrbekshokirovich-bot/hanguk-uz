import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown, ChevronUp, Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import {
  CENTER_STATUS_LABELS,
  type CreateCenterInput,
  type LearningCenterWithStats,
  useCenterStudents,
  useCreateLearningCenter,
  useLearningCenters,
  useUpdateLearningCenter,
} from '@/hooks/useLearningCenter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const NO_MANAGER = '__none__';

/** People who can work a center's leads: the roles that may read leads. */
function useLeadOwners() {
  return useQuery({
    queryKey: ['learning-center-lead-owners'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['owner', 'admin', 'call_operator']);
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', ids);
      return (profiles ?? [])
        .map((p) => ({ id: p.user_id, name: p.full_name || '—' }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

const EMPTY: CreateCenterInput = {
  name: '', city: '', address: '', contactPerson: '', phone: '', notes: '',
  assignedTo: null, username: '', password: '',
};

function CreateCenterDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState<CreateCenterInput>(EMPTY);
  const create = useCreateLearningCenter();
  const { data: owners = [] } = useLeadOwners();

  const set = (k: keyof CreateCenterInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const valid =
    form.name.trim() !== '' && /^[a-z0-9._-]{3,32}$/i.test(form.username.trim()) && form.password.length >= 6;

  const submit = async () => {
    try {
      const res = await create.mutateAsync({ ...form, username: form.username.trim().toLowerCase() });
      const credentials = `Login: ${res.username}\nParol: ${form.password}\nKirish: ${window.location.origin}/auth`;
      await navigator.clipboard?.writeText(credentials).catch(() => undefined);
      toast.success('O‘quv markaz yaratildi. Login va parol nusxalandi — markazga yuboring.');
      setForm(EMPTY);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yangi o‘quv markaz</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Markaz nomi *</Label>
            <Input value={form.name} onChange={set('name')} />
          </div>
          <div className="space-y-1.5">
            <Label>Shahar</Label>
            <Input value={form.city} onChange={set('city')} />
          </div>
          <div className="space-y-1.5">
            <Label>Manzil</Label>
            <Input value={form.address} onChange={set('address')} />
          </div>
          <div className="space-y-1.5">
            <Label>Mas’ul shaxs</Label>
            <Input value={form.contactPerson} onChange={set('contactPerson')} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={set('phone')} inputMode="tel" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Lidlar kimga biriktirilsin</Label>
            <Select
              value={form.assignedTo ?? NO_MANAGER}
              onValueChange={(v) => setForm({ ...form, assignedTo: v === NO_MANAGER ? null : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MANAGER}>Biriktirilmasin</SelectItem>
                {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Login *</Label>
            <Input value={form.username} onChange={set('username')} autoComplete="off" placeholder="masalan: sejong_markaz" />
          </div>
          <div className="space-y-1.5">
            <Label>Parol * (kamida 6)</Label>
            <Input value={form.password} onChange={set('password')} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Izoh</Label>
            <Textarea rows={2} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={!valid || create.isPending}>
            {create.isPending ? 'Yaratilmoqda…' : 'Yaratish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CenterStudents({ centerId }: { centerId: string }) {
  const { data: students = [], isLoading } = useCenterStudents(centerId);
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (students.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Hali o‘quvchi kiritilmagan.</p>;
  }
  return (
    <ul className="divide-y rounded-md border">
      {students.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{s.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {s.phone}{s.city && ` · ${s.city}`} · {new Date(s.created_at).toLocaleDateString('uz-UZ')}
            </p>
          </div>
          {s.already_lead ? (
            <Badge variant="outline">Avvaldan lid edi</Badge>
          ) : (
            <Badge variant="secondary">{CENTER_STATUS_LABELS[s.lead_status ?? 'new']}</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

function CenterRow({ center, canEdit }: { center: LearningCenterWithStats; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateLearningCenter();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {center.name}
                {!center.is_active && <Badge variant="outline" className="ml-2">O‘chirilgan</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[center.city, center.contact_person, center.phone].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-semibold tabular-nums">{center.student_count} o‘quvchi</p>
              <p className="text-xs text-muted-foreground tabular-nums">{center.converted_count} shartnoma</p>
            </div>
            {canEdit && (
              <Switch
                checked={center.is_active}
                aria-label="Faol"
                onCheckedChange={(v) =>
                  update.mutate(
                    { id: center.id, is_active: v },
                    { onError: () => toast.error('Saqlab bo‘lmadi') },
                  )
                }
              />
            )}
            <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="O‘quvchilar">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {open && (
          <div className="mt-4">
            <CenterStudents centerId={center.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LearningCentersContent() {
  const { isAdmin } = useUserRole();
  const { data: centers = [], isLoading } = useLearningCenters();
  const [creating, setCreating] = useState(false);

  const totals = useMemo(
    () => ({
      students: centers.reduce((n, c) => n + c.student_count, 0),
      converted: centers.reduce((n, c) => n + c.converted_count, 0),
    }),
    [centers],
  );

  const portalLink = `${window.location.origin}/auth`;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">O‘quv markazlar</h2>
          <p className="text-sm text-muted-foreground">
            Hamkor markazlar o‘z o‘quvchilarini kiritadi — har biri avtomatik lid bo‘lib «Lidlar» bo‘limiga tushadi.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(portalLink);
              toast.success('Kirish havolasi nusxalandi');
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Kirish havolasi
          </Button>
          {isAdmin && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" /> Yangi markaz
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold tabular-nums">{centers.length}</p><p className="text-xs text-muted-foreground">Markazlar</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold tabular-nums">{totals.students}</p><p className="text-xs text-muted-foreground">Kiritilgan o‘quvchilar</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold tabular-nums">{totals.converted}</p><p className="text-xs text-muted-foreground">Shartnoma</p></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : centers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-10 w-10" />
            Hali o‘quv markaz qo‘shilmagan.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {centers.map((c) => <CenterRow key={c.id} center={c} canEdit={isAdmin} />)}
        </div>
      )}

      <CreateCenterDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
