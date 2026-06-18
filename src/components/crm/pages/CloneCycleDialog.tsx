import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useCloneAdmissionCycle } from '@/hooks/useAdmissionCycleMutations';

interface Props {
  sourceCycleId: string;
  institutionId: string;
  sourceLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const currentYear = new Date().getFullYear();

export function CloneCycleDialog({ sourceCycleId, institutionId, sourceLabel, open, onOpenChange }: Props) {
  const cloneMut = useCloneAdmissionCycle();
  const [year, setYear] = useState(currentYear + 1);
  const [term, setTerm] = useState('fall');

  useEffect(() => {
    if (open) {
      setYear(currentYear + 1);
      setTerm('fall');
    }
  }, [open]);

  const handleClone = async () => {
    await cloneMut.mutateAsync({
      sourceCycleId,
      institution_id: institutionId,
      intake_year: year,
      intake_term: term,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Siklni nusxalash</DialogTitle>
          <DialogDescription className="text-xs">
            "{sourceLabel}" sikli — talablar va hujjatlar bilan birga yangi semestrga nusxalanadi (qoralama holatda).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Yangi yil</Label>
            <Input type="number" className="h-9 text-xs" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Yangi semestr</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spring">Bahor (Spring)</SelectItem>
                <SelectItem value="fall">Kuz (Fall)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Bekor</Button>
          <Button type="button" size="sm" disabled={cloneMut.isPending} onClick={handleClone}>
            {cloneMut.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Nusxalash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
