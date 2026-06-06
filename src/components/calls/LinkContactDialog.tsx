import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { normalizePhone } from '@/lib/phone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, User, UserPlus } from 'lucide-react';

interface LinkContactDialogProps {
  callId: string;
  phoneNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => void;
}

interface Candidate {
  type: 'student' | 'lead';
  id: string; // profiles.user_id or leads.id
  name: string;
  phone: string | null;
}

export function LinkContactDialog({ callId, phoneNumber, open, onOpenChange, onLinked }: LinkContactDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const q = query.trim();
    setLoading(true);
    const timer = setTimeout(async () => {
      const like = q ? `%${q}%` : '%';
      const [students, leads] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, phone')
          .or(`full_name.ilike.${like},phone.ilike.${like}`).limit(8),
        supabase.from('leads').select('id, full_name, phone')
          .or(`full_name.ilike.${like},phone.ilike.${like}`).limit(8),
      ]);
      if (!active) return;
      const cands: Candidate[] = [
        ...(students.data || []).map((s) => ({
          type: 'student' as const, id: s.user_id, name: s.full_name || 'Unnamed', phone: s.phone,
        })),
        ...(leads.data || []).map((l) => ({
          type: 'lead' as const, id: l.id, name: l.full_name || 'Unnamed', phone: l.phone,
        })),
      ];
      setResults(cands);
      setLoading(false);
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, open]);

  const link = async (c: Candidate) => {
    const identifier = normalizePhone(phoneNumber);
    if (!identifier) {
      toast({ title: 'No phone number', description: 'This call has no usable number to attach.', variant: 'destructive' });
      return;
    }
    setSavingId(c.id);
    try {
      const anyDb = supabase as unknown as { from: (t: string) => any };

      // 1. Persist the mapping so every future call/chat from this number links
      //    automatically (and staff can see who attached it).
      const { error: idErr } = await anyDb.from('communication_identities').upsert({
        channel: 'phone',
        identifier,
        identifier_label: phoneNumber,
        student_id: c.type === 'student' ? c.id : null,
        lead_id: c.type === 'lead' ? c.id : null,
        display_name: c.name,
        confidence: 'confirmed',
        source: 'staff',
        attached_by: user?.id ?? null,
      }, { onConflict: 'channel,identifier' });
      if (idErr) throw idErr;

      // 2. Link this call.
      const callUpdate = c.type === 'student'
        ? { student_id: c.id }
        : { lead_id: c.id };
      const { error: callErr } = await supabase.from('calls').update(callUpdate).eq('id', callId);
      if (callErr) throw callErr;

      // 3. Back-link other unattached calls from the same number.
      if (c.type === 'student') {
        await supabase.from('calls').update({ student_id: c.id })
          .eq('phone_number', phoneNumber).is('student_id', null);
      }

      toast({ title: 'Linked', description: `Calls from ${phoneNumber} are now attached to ${c.name}.` });
      onLinked?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Could not link contact',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Attach {phoneNumber} to…</DialogTitle>
          <DialogDescription>
            Pick the student or lead this number belongs to. Future calls and chats from this number will link automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-auto -mx-2 px-2 divide-y">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No matches.</p>
          ) : (
            results.map((c) => (
              <button
                key={`${c.type}-${c.id}`}
                type="button"
                disabled={savingId !== null}
                onClick={() => link(c)}
                className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/50 rounded-md px-2 disabled:opacity-50"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {c.type === 'student' ? <User className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.phone || 'No phone'}</p>
                </div>
                <Badge variant={c.type === 'student' ? 'default' : 'secondary'} className="text-xs capitalize">
                  {c.type}
                </Badge>
                {savingId === c.id && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
