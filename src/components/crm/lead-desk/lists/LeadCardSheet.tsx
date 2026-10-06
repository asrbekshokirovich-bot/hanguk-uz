import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
// Written by the card engineer; default export, props { leadId, onClose?, startCall?, className? }.
import LeadCard from '@/components/crm/lead-desk/card/LeadCard';

interface LeadCardSheetProps {
  /** null = closed */
  leadId: string | null;
  onClose: () => void;
}

/**
 * "Qator bosilsa — o'sha lid kartasi" (spec §3.3): the same card as on the desk,
 * in a right-hand sheet, so the list page keeps its place underneath.
 */
export default function LeadCardSheet({ leadId, onClose }: LeadCardSheetProps) {
  return (
    <Sheet open={leadId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[640px]">
        <SheetTitle className="sr-only">Lid kartasi</SheetTitle>
        <SheetDescription className="sr-only">Tanlangan lidning kartasi: aloqa, maydonlar va vaqt chizig'i</SheetDescription>
        {leadId && <LeadCard key={leadId} leadId={leadId} onClose={onClose} className="min-h-full" />}
      </SheetContent>
    </Sheet>
  );
}
