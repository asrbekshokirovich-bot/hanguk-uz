import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

type Channel = 'phone' | 'telegram' | 'instagram' | 'whatsapp';

interface LinkContactDialogProps {
  /** Which channel this identifier belongs to. */
  channel: Channel;
  /** Raw identifier — a phone number, or a Telegram chat/user id. */
  identifier: string;
  /** Human-friendly label shown in the title (e.g. the name or @handle). */
  identifierLabel?: string;
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

export function LinkContactDialog({
  channel,
  identifier,
  identifierLabel,
  open,
  onOpenChange,
  onLinked,
}: LinkContactDialogProps) {
  const { t } = useTranslation();
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
        supabase.from('leads').select('id, full_name, phone').eq('qualified', true)
          .or(`full_name.ilike.${like},phone.ilike.${like}`).limit(8),
      ]);
      if (!active) return;
      setResults([
        ...(students.data || []).map((s) => ({
          type: 'student' as const, id: s.user_id, name: s.full_name || '—', phone: s.phone,
        })),
        ...(leads.data || []).map((l) => ({
          type: 'lead' as const, id: l.id, name: l.full_name || '—', phone: l.phone,
        })),
      ]);
      setLoading(false);
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, open]);

  const link = async (c: Candidate) => {
    const canonical = channel === 'phone' ? normalizePhone(identifier) : identifier;
    if (!canonical) {
      toast({
        title: t('linkContact.noIdentifierTitle'),
        description: t('linkContact.noIdentifierBody'),
        variant: 'destructive',
      });
      return;
    }
    setSavingId(c.id);
    try {
      const anyDb = supabase as unknown as { from: (t: string) => any };

      // 1. Persist the mapping so future messages/calls auto-link, and staff can
      //    see who attached it.
      const { error: idErr } = await anyDb.from('communication_identities').upsert({
        channel,
        identifier: canonical,
        identifier_label: identifierLabel || identifier,
        student_id: c.type === 'student' ? c.id : null,
        lead_id: c.type === 'lead' ? c.id : null,
        display_name: c.name,
        confidence: 'confirmed',
        source: 'staff',
        attached_by: user?.id ?? null,
      }, { onConflict: 'channel,identifier' });
      if (idErr) throw idErr;

      // 2. Back-link existing records on this channel.
      await backfill(c, canonical);

      toast({ title: t('linkContact.linked'), description: t('linkContact.linkedBody', { name: c.name }) });
      onLinked?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: t('linkContact.failed'),
        description: e instanceof Error ? e.message : t('common.error'),
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const backfill = async (c: Candidate, _canonical: string) => {
    if (channel === 'phone') {
      if (c.type === 'student') {
        await supabase.from('calls').update({ student_id: c.id })
          .eq('phone_number', identifier).is('student_id', null);
      } else {
        await supabase.from('calls').update({ lead_id: c.id })
          .eq('phone_number', identifier).is('lead_id', null).is('student_id', null);
      }
    } else {
      // Every messaging channel backfills the same way, keyed on
      // (source, sender_id). This used to test `channel === 'telegram'`
      // literally, so linking an Instagram conversation wrote the identity row
      // and then silently changed nothing the operator could see — the thread
      // stayed anonymous in the queue. `channel` IS the source value.
      //
      // message_threads/messages only carry a student link; for leads the
      // identity mapping is what carries the association until the lead is
      // converted to a student.
      if (c.type === 'student') {
        await supabase.from('message_threads').update({ student_id: c.id })
          .eq('source', channel).eq('sender_id', identifier).is('student_id', null);
        await supabase.from('messages').update({ student_id: c.id })
          .eq('source', channel).eq('sender_id', identifier).is('student_id', null);
      }
    }
  };

  const title = identifierLabel || identifier;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('linkContact.title', { name: title })}</DialogTitle>
          <DialogDescription>
            {channel === 'phone' ? t('linkContact.hintPhone') : t('linkContact.hintChat')}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder={t('linkContact.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-auto -mx-2 px-2 divide-y">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('linkContact.searching')}
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t('linkContact.noMatches')}</p>
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
                  <p className="text-xs text-muted-foreground truncate">{c.phone || t('linkContact.noPhone')}</p>
                </div>
                <Badge variant={c.type === 'student' ? 'default' : 'secondary'} className="text-xs">
                  {c.type === 'student' ? t('linkContact.student') : t('linkContact.lead')}
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
