import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, ClipboardPaste, LogOut, Phone, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  CENTER_STATUS_LABELS,
  type AddStudentsResult,
  type CenterStudent,
  type NewCenterStudent,
  parseStudentRows,
  useAddCenterStudents,
  useCenterStudents,
  useMyLearningCenter,
} from '@/hooks/useLearningCenter';
import { Logo } from '@/components/Logo';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const KOREAN_LEVELS = ['Boshlang‘ich', 'TOPIK 1', 'TOPIK 2', 'TOPIK 3', 'TOPIK 4', 'TOPIK 5', 'TOPIK 6'];

const EMPTY_FORM = { full_name: '', phone: '', city: '', age: '', korean_level: '', notes: '' };

function statusBadge(s: CenterStudent) {
  if (s.already_lead) {
    return <Badge variant="outline" className="text-muted-foreground">Avvaldan bazamizda</Badge>;
  }
  const status = s.lead_status ?? 'new';
  const tone =
    status === 'converted'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
      : status === 'lost'
        ? 'bg-muted text-muted-foreground'
        : status === 'new'
          ? 'bg-primary/10 text-primary'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  return <Badge className={`${tone} border-0 font-medium`}>{CENTER_STATUS_LABELS[status]}</Badge>;
}

function reportResult(r: AddStudentsResult) {
  if (r.added > 0) toast.success(`${r.added} ta o‘quvchi qo‘shildi va lid sifatida yuborildi`);
  if (r.duplicates.length > 0) {
    toast.warning(`Allaqachon kiritilgan: ${r.duplicates.join(', ')}`);
  }
  if (r.failed.length > 0) {
    toast.error(`${r.failed.length} ta qatorni saqlab bo‘lmadi: ${r.failed.map((f) => f.row.full_name).join(', ')}`);
  }
}

export default function LearningCenterPortal() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { isLearningCenter, loading: roleLoading } = useUserRole();
  const { data: center, isLoading: centerLoading } = useMyLearningCenter();
  const { data: students = [], isLoading: studentsLoading } = useCenterStudents(center?.id);
  const addStudents = useAddCenterStudents(center?.id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [pasted, setPasted] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) navigate('/auth');
    else if (!isLearningCenter) navigate('/');
  }, [user, isLearningCenter, authLoading, roleLoading, navigate]);

  const parsed = useMemo(() => parseStudentRows(pasted), [pasted]);

  const stats = useMemo(() => {
    const own = students.filter((s) => !s.already_lead);
    return {
      total: students.length,
      inProgress: own.filter((s) => s.lead_status === 'contacted' || s.lead_status === 'qualified').length,
      converted: own.filter((s) => s.lead_status === 'converted').length,
    };
  }, [students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    const digits = q.replace(/\D/g, '');
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(q) || (digits && s.phone.replace(/\D/g, '').includes(digits)),
    );
  }, [students, query]);

  const phoneOk = form.phone.replace(/\D/g, '').length >= 9;
  const canSubmitOne = form.full_name.trim() !== '' && phoneOk && !addStudents.isPending;

  const submitOne = async () => {
    const row: NewCenterStudent = {
      full_name: form.full_name,
      phone: form.phone,
      city: form.city,
      age: form.age ? Number(form.age) : null,
      korean_level: form.korean_level,
      notes: form.notes,
    };
    const result = await addStudents.mutateAsync([row]);
    reportResult(result);
    if (result.added > 0) setForm(EMPTY_FORM);
  };

  const submitPasted = async () => {
    const result = await addStudents.mutateAsync(parsed.rows);
    reportResult(result);
    if (result.failed.length === 0) setPasted('');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || roleLoading || centerLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex animate-pulse flex-col items-center gap-4">
          <Logo className="h-16 w-16" />
        </div>
      </div>
    );
  }

  if (!center) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Bu akkaunt hech qaysi o‘quv markazga bog‘lanmagan.</p>
            <Button variant="outline" className="mt-6" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Chiqish
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-primary">{center.name}</h1>
              <p className="text-xs text-muted-foreground">Hanguk hamkor o‘quv markazi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Chiqish</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4">
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Kiritilgan o‘quvchilar</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Phone className="mx-auto mb-1 h-5 w-5 text-amber-600" />
              <p className="text-2xl font-bold tabular-nums">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">Ish jarayonida</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
              <p className="text-2xl font-bold tabular-nums">{stats.converted}</p>
              <p className="text-xs text-muted-foreground">Shartnoma tuzildi</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">O‘quvchi qo‘shish</CardTitle>
            <p className="text-sm text-muted-foreground">
              Kiritilgan har bir o‘quvchi darhol Hanguk jamoasiga yuboriladi va biz u bilan bog‘lanamiz.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="one">
              <TabsList className="mb-4">
                <TabsTrigger value="one" className="gap-2"><UserPlus className="h-4 w-4" /> Bittalab</TabsTrigger>
                <TabsTrigger value="list" className="gap-2"><ClipboardPaste className="h-4 w-4" /> Ro‘yxat</TabsTrigger>
              </TabsList>

              <TabsContent value="one">
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (canSubmitOne) void submitOne();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="lc-name">Ism familiya *</Label>
                    <Input id="lc-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lc-phone">Telefon raqami *</Label>
                    <Input
                      id="lc-phone"
                      inputMode="tel"
                      placeholder="+998 90 123 45 67"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lc-city">Shahar / viloyat</Label>
                    <Input id="lc-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="lc-age">Yoshi</Label>
                      <Input
                        id="lc-age"
                        type="number"
                        min={10}
                        max={80}
                        value={form.age}
                        onChange={(e) => setForm({ ...form, age: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Koreys tili</Label>
                      <Select value={form.korean_level} onValueChange={(v) => setForm({ ...form, korean_level: v })}>
                        <SelectTrigger><SelectValue placeholder="Darajasi" /></SelectTrigger>
                        <SelectContent>
                          {KOREAN_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="lc-notes">Izoh</Label>
                    <Textarea
                      id="lc-notes"
                      rows={2}
                      placeholder="Masalan: bakalavrga qiziqadi, 2027 bahorga"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={!canSubmitOne}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {addStudents.isPending ? 'Saqlanmoqda…' : 'Qo‘shish'}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="list" className="space-y-3">
                <Textarea
                  rows={7}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder={'Har bir qatorga bitta o‘quvchi: ism va telefon.\nAli Valiyev, +998 90 123 45 67\nMadina Karimova; 93 456 78 90'}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Excel yoki Google Sheets’dan ikki ustunni (ism, telefon) nusxalab qo‘yishingiz mumkin.
                  {parsed.rows.length > 0 && ` Tayyor: ${parsed.rows.length} ta.`}
                  {parsed.invalid.length > 0 && ` Tushunilmadi: ${parsed.invalid.length} ta qator.`}
                </p>
                <Button onClick={() => void submitPasted()} disabled={parsed.rows.length === 0 || addStudents.isPending}>
                  <ClipboardPaste className="mr-2 h-4 w-4" />
                  {addStudents.isPending ? 'Saqlanmoqda…' : `${parsed.rows.length || ''} ta o‘quvchini qo‘shish`}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="text-base">O‘quvchilarim</CardTitle>
            <div className="flex h-9 w-full max-w-60 items-center gap-2 rounded-md border border-border bg-background px-3">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ism yoki telefon"
                aria-label="Qidirish"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {studentsLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {students.length === 0 ? 'Hali o‘quvchi kiritilmagan.' : 'Hech narsa topilmadi.'}
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.phone}
                        {s.city && ` · ${s.city}`}
                        {` · ${new Date(s.created_at).toLocaleDateString('uz-UZ')}`}
                      </p>
                    </div>
                    {statusBadge(s)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
