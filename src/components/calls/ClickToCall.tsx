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

    // Debounce: prevent rapid duplicate calls
    const now = Date.now();
    if (now - lastCallRef.current < DEBOUNCE_MS) {
      toast({ title: "Biroz kuting", description: "Qo'ng'iroq allaqachon boshlangan", variant: 'destructive' });
      return;
    }
    lastCallRef.current = now;

    // Log with initial status 'no_answer'
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
      toast({ title: "Qo'ng'iroq boshlandi", description: normalized });
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
