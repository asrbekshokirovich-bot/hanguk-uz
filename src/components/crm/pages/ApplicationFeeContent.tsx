/**
 * Application fee — joriy sezondagi (masalan 2027-bahor, tepadagi sezon
 * almashtirgich bilan tanlanadi) har bir talabaning application fee
 * to'lovlari. Talabalar ro'yxati boshqa hamma bo'lim bilan bir xil manbadan
 * (student_intakes) keladi, shuning uchun Talabalar bo'limiga qo'shilgan
 * talaba shu yerda ham avtomatik ko'rinadi.
 */

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertTriangle, Loader2, Receipt, Search } from 'lucide-react';
import { useApplicationFeeRoster, type FeeRosterEntry } from '@/hooks/useApplicationFeePayments';
import { FeeStudentCard } from './application-fees/FeeStudentCard';
import { StudentFeeSheet } from './application-fees/StudentFeeSheet';

export default function ApplicationFeeContent() {
  const { roster, loading, error, refetch } = useApplicationFeeRoster();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FeeRosterEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((r) => (r.full_name ?? '').toLowerCase().includes(q));
  }, [roster, search]);

  const paidCount = useMemo(() => roster.filter((r) => r.paidCount > 0).length, [roster]);

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Ro'yxatni yuklab bo'lmadi"
        description={error.message}
        action={{ label: 'Qayta urinish', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Receipt className="h-4 w-4" aria-hidden="true" />
          <span>
            {roster.length} talaba
            {paidCount > 0 && ` · ${paidCount} tasida to'lov bor`}
          </span>
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Talaba qidirish"
            className="pl-8"
            aria-label="Talaba qidirish"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Talaba topilmadi"
          description="Joriy sezonda talaba yo'q yoki qidiruvni o'zgartiring."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((entry) => (
            <FeeStudentCard
              key={entry.student_id}
              entry={entry}
              onOpen={(e) => {
                setSelected(e);
                setSheetOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <StudentFeeSheet
        studentId={selected?.student_id ?? null}
        studentName={selected?.full_name ?? null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
