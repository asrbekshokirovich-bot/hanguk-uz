import { useState } from 'react';
import { Phone, PhoneOff, PhoneMissed, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CallOutcomeDialogProps {
  open: boolean;
  onOutcome: (status: string, duration?: number) => void;
  phoneNumber: string;
}

export function CallOutcomeDialog({ open, onOutcome, phoneNumber }: CallOutcomeDialogProps) {
  const [duration, setDuration] = useState('');

  const handleOutcome = (status: string) => {
    const dur = duration ? parseInt(duration) : undefined;
    onOutcome(status, dur);
    setDuration('');
  };

  return (
    <Dialog open={open} onOpenChange={() => handleOutcome('no_answer')}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Qo'ng'iroq natijasi</DialogTitle>
          <DialogDescription>{phoneNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="duration">Davomiyligi (soniya)</Label>
            <Input
              id="duration"
              type="number"
              placeholder="Masalan: 120"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min={0}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="default"
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={() => handleOutcome('completed')}
            >
              <Phone className="h-5 w-5" />
              <span className="text-xs">Javob berdi</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={() => handleOutcome('no_answer')}
            >
              <PhoneMissed className="h-5 w-5" />
              <span className="text-xs">Javob bermadi</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={() => handleOutcome('busy')}
            >
              <PhoneOff className="h-5 w-5" />
              <span className="text-xs">Band</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
