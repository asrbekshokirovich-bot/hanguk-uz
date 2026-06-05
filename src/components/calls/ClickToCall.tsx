import { useState, useRef } from 'react';
import { Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CallOutcomeDialog } from './CallOutcomeDialog';

interface ClickToCallProps {
  phoneNumber: string;
  studentId?: string;
  leadId?: string;
  showIcon?: boolean;
  className?: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('998')) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return `+${digits}`;
}

const DEBOUNCE_MS = 5000;

export function ClickToCall({ phoneNumber, studentId, leadId, showIcon = true, className }: ClickToCallProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const lastCallRef = useRef<number>(0);
  const [showOutcome, setShowOutcome] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);

  if (!phoneNumber) return <span className="text-muted-foreground">-</span>;

  const normalized = normalizePhone(phoneNumber);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const now = Date.now();
    if (now - lastCallRef.current < DEBOUNCE_MS) {
      toast({ title: "Biroz kuting", description: "Qo'ng'iroq allaqachon boshlangan", variant: 'destructive' });
      return;
    }
    lastCallRef.current = now;

    // Ask Mediateka to ring the agent's softphone and dial the customer.
    // If it succeeds, the canonical `calls` row will be created by the
    // voip-webhook when Mediateka emits cmd=history. If it fails, fall back
    // to the manual logging flow so the click is never silently lost.
    const { data: makecall, error: makecallError } = await supabase.functions.invoke(
      'mediateka-makecall',
      { body: { phone: normalized } },
    );

    if (!makecallError && makecall?.success) {
      toast({
        title: "Qo'ng'iroq boshlandi",
        description: `Telefon jiringlaydi va ${normalized} raqamiga ulanasiz`,
      });
      return;
    }

    // Fallback path — used when MEDIATEKA_API_KEY isn't set, the agent isn't
    // staff, or Mediateka rejected the makecall. Log a manual call row and
    // let the user record the outcome by hand.
    if (makecallError) {
      console.warn('mediateka-makecall fallback:', makecallError);
    }

    const { data, error } = await supabase.from('calls').insert({
      phone_number: normalized,
      direction: 'outgoing' as string,
      status: 'no_answer' as string,
      staff_id: user.id,
      student_id: studentId || null,
      lead_id: leadId || null,
      started_at: new Date().toISOString(),
    }).select('id').single();

    if (!error && data) {
      setCurrentCallId(data.id);
      setShowOutcome(true);
      toast({ title: "Qo'ng'iroq boshlandi (qo'lda)", description: normalized });
    }
  };

  const handleOutcome = async (status: string, duration?: number) => {
    setShowOutcome(false);
    if (!currentCallId) return;

    const updates: Record<string, unknown> = { status };
    if (duration) updates.duration = duration;
    if (status === 'completed' || status === 'busy' || status === 'no_answer') {
      updates.ended_at = new Date().toISOString();
    }

    await supabase.from('calls').update(updates).eq('id', currentCallId);
    setCurrentCallId(null);
  };

  return (
    <>
      <a
        href={`tel:${normalized}`}
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1.5 text-primary hover:underline font-medium transition-colors',
          className
        )}
      >
        {showIcon && <Phone className="h-3.5 w-3.5" />}
        {phoneNumber}
      </a>
      <CallOutcomeDialog
        open={showOutcome}
        onOutcome={handleOutcome}
        phoneNumber={normalized}
      />
    </>
  );
}
