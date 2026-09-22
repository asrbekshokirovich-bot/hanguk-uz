import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X, Receipt, GraduationCap } from 'lucide-react';
import {
  useStudentFeePayments,
  useAddFeePayments,
  type FeePaymentInput,
  type InstitutionOption,
} from '@/hooks/useApplicationFeePayments';
import { InstitutionPickerDialog } from './InstitutionPickerDialog';
import { FeeReceiptUpload, type FeeReceipt } from './FeeReceiptUpload';

interface FeeBlock {
  key: string;
  institution: InstitutionOption | null;
  amount: string;
  receipt: FeeReceipt | null;
}

const newBlock = (): FeeBlock => ({
  key: crypto.randomUUID(),
  institution: null,
  amount: '',
  receipt: null,
});

function formatWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('en-US')}`;
}

interface Props {
  studentId: string | null;
  studentName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Talaba paneli: mavjud application fee to'lovlari + "+ App fee" — universitet,
 * summa (KRW) va chekdan iborat xohlagancha blok qo'shib, birdaniga saqlash.
 */
export function StudentFeeSheet({ studentId, studentName, open, onOpenChange }: Props) {
  const { payments, loading } = useStudentFeePayments(open ? studentId : null);
  const addPayments = useAddFeePayments();
  const { toast } = useToast();

  const [adding, setAdding] = useState(false);
  const [blocks, setBlocks] = useState<FeeBlock[]>([newBlock()]);
  const [pickerForKey, setPickerForKey] = useState<string | null>(null);

  const startAdding = () => {
    setBlocks([newBlock()]);
    setAdding(true);
  };

  const addBlock = () => setBlocks((b) => [...b, newBlock()]);
  const removeBlock = (key: string) => setBlocks((b) => (b.length <= 1 ? b : b.filter((x) => x.key !== key)));
  const updateBlock = (key: string, patch: Partial<FeeBlock>) =>
    setBlocks((b) => b.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const submit = async () => {
    if (!studentId) return;
    const entries: FeePaymentInput[] = [];
    for (const block of blocks) {
      const amount = Number(block.amount);
      if (!block.institution || !Number.isFinite(amount) || amount <= 0) continue;
      entries.push({
        institution_id: block.institution.id,
        amount_krw: amount,
        receipt_url: block.receipt?.url ?? null,
        receipt_file_name: block.receipt?.fileName ?? null,
      });
    }
    if (entries.length === 0) {
      toast({ title: "Kamida bitta blokda universitet va summa to'ldirilsin", variant: 'destructive' });
      return;
    }
    try {
      await addPayments.mutateAsync({ studentId, entries });
      toast({ title: `${entries.length} ta to'lov qo'shildi` });
      setAdding(false);
      setBlocks([newBlock()]);
    } catch (err) {
      toast({
        title: "Saqlab bo'lmadi",
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setAdding(false);
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{studentName ?? ''}</SheetTitle>
          <SheetDescription>Application fee to'lovlari</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {!adding && (
            <Button onClick={startAdding} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              App fee qo'shish
            </Button>
          )}

          {adding && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              {blocks.map((block) => (
                <div
                  key={block.key}
                  className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">Universitet</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full min-w-0 justify-start"
                      onClick={() => setPickerForKey(block.key)}
                    >
                      <GraduationCap className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {block.institution ? block.institution.name_en || block.institution.name_ko : 'Tanlash'}
                      </span>
                    </Button>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">Summa (₩)</p>
                    <Input
                      inputMode="numeric"
                      placeholder="Masalan: 100000"
                      value={block.amount}
                      onChange={(e) => updateBlock(block.key, { amount: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">Chek</p>
                    <FeeReceiptUpload
                      value={block.receipt}
                      onChange={(receipt) => updateBlock(block.key, { receipt })}
                      studentId={studentId ?? 'unknown'}
                    />
                  </div>
                  {blocks.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="justify-self-end text-muted-foreground sm:mt-5"
                      onClick={() => removeBlock(block.key)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={addBlock}>
                  <Plus className="mr-2 h-4 w-4" />
                  Yana universitet qo'shish
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                    Bekor qilish
                  </Button>
                  <Button type="button" size="sm" onClick={submit} disabled={addPayments.isPending}>
                    {addPayments.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Saqlash
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <EmptyState icon={Receipt} title="Hali to'lov qo'shilmagan" />
          ) : (
            <div className="rounded-lg border">
              <ol className="divide-y">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {p.institution?.name_en || p.institution?.name_ko || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString('uz-UZ')}
                        {p.receipt_url && (
                          <>
                            {' · '}
                            <a
                              href={p.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              chek
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <Badge variant="successSoft" className="shrink-0">
                      {formatWon(p.amount_krw)}
                    </Badge>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <InstitutionPickerDialog
          open={pickerForKey !== null}
          onOpenChange={(o) => {
            if (o) return;
            setPickerForKey(null);
            // Ichma-ich Radix dialoglar (bu panel + tanlash oynasi) ba'zan
            // <body>'dagi pointer-events qulfini yopilgandan keyin ham
            // qaytarib bermaydi — natijada "Saqlash" kabi tugmalar hech
            // qanday xatosiz bosilmay qoladi. Ehtiyot chorasi sifatida tozalaymiz.
            requestAnimationFrame(() => {
              document.body.style.pointerEvents = '';
            });
          }}
          onPick={(inst) => {
            if (pickerForKey) updateBlock(pickerForKey, { institution: inst });
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
