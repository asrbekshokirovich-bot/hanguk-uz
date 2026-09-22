import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GraduationCap, MapPin, Search } from 'lucide-react';
import { useInstitutionOptions, type InstitutionOption } from '@/hooks/useApplicationFeePayments';

function institutionName(inst: InstitutionOption): string {
  return inst.name_en?.trim() || inst.name_ko;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (institution: InstitutionOption) => void;
}

/** Qidiruv + ro'yxat dialogi — ApplicationsContent'dagi UniversityPickerDialog bilan bir xil ko'rinish. */
export function InstitutionPickerDialog({ open, onOpenChange, onPick }: Props) {
  const { data: institutions = [] } = useInstitutionOptions();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const named = institutions
      .map((u) => ({ u, name: institutionName(u) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const q = search.trim().toLowerCase();
    if (!q) return named;
    return named.filter(
      ({ u, name }) =>
        name.toLowerCase().includes(q) ||
        u.name_ko.toLowerCase().includes(q) ||
        (u.city_ko ?? '').toLowerCase().includes(q),
    );
  }, [institutions, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-info" />
            Universitet tanlash
          </DialogTitle>
          <DialogDescription>Application fee to'langan universitetni tanlang.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Universitet qidirish"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-[52vh] overflow-y-auto rounded-md border border-border">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Universitet topilmadi</div>
          ) : (
            filtered.map(({ u, name }) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onPick(u);
                  onOpenChange(false);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-accent/50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10">
                    <GraduationCap className="h-4 w-4 text-info" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{name}</div>
                    {u.city_ko ? (
                      <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {u.city_ko}
                      </div>
                    ) : null}
                  </div>
                </div>
                {u.is_partner ? <Badge variant="successSoft">Hamkor</Badge> : null}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
