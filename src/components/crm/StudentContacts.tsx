import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Trash2,
  Pencil,
  Phone,
  MessageCircle,
  Instagram,
  Star,
  User,
  Users,
  Loader2,
} from 'lucide-react';

type Contact = Tables<'student_contacts'>;

const CONTACT_TYPES = [
  { value: 'telegram', label: 'Telegram', icon: MessageCircle },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'phone', label: 'Telefon', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'other', label: 'Boshqa', icon: User },
] as const;

const OWNER_OPTIONS = [
  { value: 'student', label: "O'quvchi o'zi", icon: User },
  { value: 'parent', label: 'Ota-ona', icon: Users },
  { value: 'other', label: 'Boshqa', icon: User },
] as const;

function contactIcon(type: string) {
  const found = CONTACT_TYPES.find((ct) => ct.value === type);
  return found ? found.icon : User;
}

function contactTypeLabel(type: string) {
  return CONTACT_TYPES.find((ct) => ct.value === type)?.label ?? type;
}

function ownerLabel(owner: string) {
  return OWNER_OPTIONS.find((o) => o.value === owner)?.label ?? owner;
}

function ownerBadgeVariant(owner: string) {
  if (owner === 'student') return 'default' as const;
  if (owner === 'parent') return 'secondary' as const;
  return 'outline' as const;
}

interface StudentContactsProps {
  studentId: string;
}

export function StudentContacts({ studentId }: StudentContactsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: 'telegram',
    value: '',
    owner: 'student',
    label: '',
    is_primary: false,
  });

  const fetchContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from('student_contacts')
      .select('*')
      .eq('student_id', studentId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (!error && data) setContacts(data);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const openAdd = () => {
    setEditing(null);
    setForm({ type: 'telegram', value: '', owner: 'student', label: '', is_primary: false });
    setDialogOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      type: c.type,
      value: c.value,
      owner: c.owner,
      label: c.label || '',
      is_primary: c.is_primary,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.value.trim()) {
      toast({ title: "Qiymat bo'sh bo'lmasligi kerak", variant: 'destructive' });
      return;
    }
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from('student_contacts')
        .update({
          type: form.type,
          value: form.value.trim(),
          owner: form.owner,
          label: form.label.trim() || null,
          is_primary: form.is_primary,
        })
        .eq('id', editing.id);

      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: "Kontakt yangilandi" });
        setDialogOpen(false);
        fetchContacts();
      }
    } else {
      const { error } = await supabase.from('student_contacts').insert({
        student_id: studentId,
        type: form.type,
        value: form.value.trim(),
        owner: form.owner,
        label: form.label.trim() || null,
        is_primary: form.is_primary,
      });

      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: "Kontakt qo'shildi" });
        setDialogOpen(false);
        fetchContacts();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('student_contacts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: "Kontakt o'chirildi" });
      fetchContacts();
    }
  };

  const grouped = contacts.reduce<Record<string, Contact[]>>((acc, c) => {
    const key = c.owner;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Kontaktlar ({contacts.length})</h3>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Kontakt qo'shish
        </Button>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Hali kontakt qo'shilmagan. "Kontakt qo'shish" tugmasini bosing.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([ownerKey, items]) => (
          <Card key={ownerKey}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {ownerKey === 'parent' ? (
                  <Users className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
                {ownerLabel(ownerKey)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((c) => {
                const Icon = contactIcon(c.type);
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-accent/50 transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{c.value}</span>
                        {c.is_primary && (
                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {contactTypeLabel(c.type)}
                        </Badge>
                        {c.label && (
                          <span className="text-[11px] text-muted-foreground">{c.label}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Kontaktni tahrirlash' : "Yangi kontakt qo'shish"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Turi</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {form.type === 'phone' || form.type === 'whatsapp'
                  ? 'Telefon raqam'
                  : form.type === 'telegram'
                    ? 'Username yoki raqam'
                    : form.type === 'instagram'
                      ? 'Username'
                      : 'Qiymat'}
              </Label>
              <Input
                placeholder={
                  form.type === 'telegram'
                    ? '@username yoki +998...'
                    : form.type === 'instagram'
                      ? '@username'
                      : form.type === 'phone' || form.type === 'whatsapp'
                        ? '+998 90 123 45 67'
                        : 'Kontakt...'
                }
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Kimniki</Label>
              <Select value={form.owner} onValueChange={(v) => setForm((f) => ({ ...f, owner: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Izoh (ixtiyoriy)</Label>
              <Input
                placeholder="Masalan: Otasi, Onasi, Ukasi..."
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_primary"
                checked={form.is_primary}
                onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="is_primary" className="cursor-pointer">
                Asosiy kontakt
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.value.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Saqlash' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
