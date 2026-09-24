import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Bell, Loader2, Search } from 'lucide-react';

/** push_recipients is newer than the generated types; see useLeadProfile. */
const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export interface PushRecipient {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  devices: number;
}

interface Props {
  /** The survey being announced; null keeps the dialog closed. */
  target: { surveyId: string; title: string } | null;
  sending: boolean;
  onClose: () => void;
  onSend: (userIds: string[]) => void;
}

/**
 * Pick who gets a survey notification.
 *
 * It used to go to every device with a push token the moment a survey was
 * created, and the owner wants to choose instead (2026-09-24). Only students
 * who can actually receive one are listed — the app installed and a token
 * enabled — because ticking someone without the app would promise a
 * notification that never arrives. Nothing is preselected: sending needs at
 * least one deliberate tick.
 */
export default function PushRecipientsDialog({ target, sending, onClose, onSend }: Props) {
  const [people, setPeople] = useState<PushRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!target) return;
    setQuery('');
    setPicked(new Set());
    setError(null);
    setLoading(true);
    db.rpc('push_recipients').then(({ data, error: rpcError }: { data: PushRecipient[] | null; error: { message: string } | null }) => {
      if (rpcError) setError(rpcError.message);
      setPeople(data ?? []);
      setLoading(false);
    });
  }, [target]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    const digits = q.replace(/\D/g, '');
    return people.filter((p) =>
      (p.full_name ?? '').toLowerCase().includes(q) ||
      (digits.length > 0 && (p.phone ?? '').replace(/\D/g, '').includes(digits)),
    );
  }, [people, query]);

  const allVisiblePicked = visible.length > 0 && visible.every((p) => picked.has(p.user_id));

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (allVisiblePicked) visible.forEach((p) => next.delete(p.user_id));
      else visible.forEach((p) => next.add(p.user_id));
      return next;
    });
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open && !sending) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bildirishnoma kimga borsin?</DialogTitle>
          <DialogDescription>
            «{target?.title}» — ilovani o'rnatgan talabalar. Kerakli odamlarni belgilang.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism yoki telefon bo'yicha qidirish"
            className="pl-8"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive">Ro'yxat yuklanmadi: {error}</div>
          ) : people.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Ilovani o'rnatgan talaba topilmadi — bildirishnoma hech kimga bormaydi.
            </div>
          ) : (
            <>
              <label className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-sm font-medium cursor-pointer">
                <Checkbox checked={allVisiblePicked} onCheckedChange={toggleAllVisible} />
                {query.trim() ? "Ko'rinayotganlarning hammasi" : 'Hammasini belgilash'} ({visible.length})
              </label>
              {visible.map((p) => (
                <label
                  key={p.user_id}
                  className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox checked={picked.has(p.user_id)} onCheckedChange={() => toggle(p.user_id)} />
                  <span className="flex-1 truncate">{p.full_name || 'Ismsiz'}</span>
                  {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                </label>
              ))}
              {visible.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">Hech kim topilmadi</div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Bekor qilish
          </Button>
          <Button onClick={() => onSend([...picked])} disabled={sending || picked.size === 0}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
            Yuborish ({picked.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
