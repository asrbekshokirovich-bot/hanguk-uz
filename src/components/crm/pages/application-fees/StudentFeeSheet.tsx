import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X, Receipt, GraduationCap, Pencil, Trash2 } from 'lucide-react';
import {
  useStudentFeePayments,
  useAddFeePayments,
  useUpdateFeePayment,
  useDeleteFeePayment,
  type FeePayment,
  type FeePaymentInput,
  type InstitutionOption,
} from '@/hooks/useApplicationFeePayments';
import { InstitutionPickerDialog } from './InstitutionPickerDialog';
import { FeeReceiptUpload, type FeeReceipt } from './FeeReceiptUpload';

interface FeeBlock {
  key: string;
  institution: InstitutionOption | null;
  amount: string;
  expense: string;
  receipt: FeeReceipt | null;
}

const newBlock = (): FeeBlock => ({
  key: crypto.randomUUID(),
  institution: null,
  amount: '',
  expense: '',
  receipt: null,
});

/** Bo'sh — hali kiritilmagan; aks holda faqat raqamlardan iborat qatordagi son. */
function parseOptionalAmount(raw: string): number | null {
  return raw.trim() === '' ? null : Number(raw);
}

function formatWon(n: number): string {
  return `₩${Math.round(n).toLocaleString('en-US')}`;
}

/** Universitet + summa + chek — bir blokning uchta katakchasi. "+ App fee" va tahrirlashda bir xil ko'rinish. */
function FeeBlockFields({
  institution,
  amount,
  expense,
  receipt,
  studentId,
  onPickInstitution,
  onAmountChange,
  onExpenseChange,
  onReceiptChange,
}: {
  institution: { name_en: string | null; name_ko: string } | null;
  amount: string;
  expense: string;
  receipt: FeeReceipt | null;
  studentId: string;
  onPickInstitution: () => void;
  onAmountChange: (value: string) => void;
  onExpenseChange: (value: string) => void;
  onReceiptChange: (receipt: FeeReceipt | null) => void;
}) {
  return (
    <>
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">Universitet</p>
        <Button
          type="button"
          variant="outline"
          className="w-full min-w-0 justify-start"
          onClick={onPickInstitution}
        >
          <GraduationCap className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {institution ? institution.name_en || institution.name_ko : 'Tanlash'}
          </span>
        </Button>
      </div>
      <div className="min-w-0 space-y-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Summa (₩)</p>
          <Input
            inputMode="numeric"
            placeholder="Masalan: 100000"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Chiqim (₩)</p>
          <Input
            inputMode="numeric"
            placeholder="Universitetga jo'natilgan summa"
            value={expense}
            onChange={(e) => onExpenseChange(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">Chek</p>
        <FeeReceiptUpload value={receipt} onChange={onReceiptChange} studentId={studentId} />
      </div>
    </>
  );
}

interface Props {
  studentId: string | null;
  studentName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PickerTarget = { type: 'block'; key: string } | { type: 'edit' } | null;

/**
 * Talaba paneli: mavjud application fee to'lovlari (tahrirlash/o'chirish bilan)
 * + "+ App fee" — universitet, summa (KRW) va chekdan iborat xohlagancha blok
 * qo'shib, birdaniga saqlash.
 */
export function StudentFeeSheet({ studentId, studentName, open, onOpenChange }: Props) {
  const { payments, loading } = useStudentFeePayments(open ? studentId : null);
  const addPayments = useAddFeePayments();
  const updatePayment = useUpdateFeePayment();
  const deletePayment = useDeleteFeePayment();
  const { toast } = useToast();

  const [adding, setAdding] = useState(false);
  const [blocks, setBlocks] = useState<FeeBlock[]>([newBlock()]);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInstitution, setEditInstitution] = useState<InstitutionOption | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editExpense, setEditExpense] = useState('');
  const [editReceipt, setEditReceipt] = useState<FeeReceipt | null>(null);

  const startAdding = () => {
    setBlocks([newBlock()]);
    setAdding(true);
  };

  const addBlock = () => setBlocks((b) => [...b, newBlock()]);
  const removeBlock = (key: string) => setBlocks((b) => (b.length <= 1 ? b : b.filter((x) => x.key !== key)));
  const updateBlock = (key: string, patch: Partial<FeeBlock>) =>
    setBlocks((b) => b.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const closePicker = () => {
    setPickerTarget(null);
    // Ichma-ich Radix dialoglar (bu panel + tanlash oynasi) ba'zan
    // <body>'dagi pointer-events qulfini yopilgandan keyin ham
    // qaytarib bermaydi — natijada tugmalar hech qanday xatosiz
    // bosilmay qoladi. Ehtiyot chorasi sifatida tozalaymiz.
    requestAnimationFrame(() => {
      document.body.style.pointerEvents = '';
    });
  };

  const submit = async () => {
    if (!studentId) return;
    const entries: FeePaymentInput[] = [];
    for (const block of blocks) {
      const amount = Number(block.amount);
      if (!block.institution || !Number.isFinite(amount) || amount <= 0) continue;
      entries.push({
        institution_id: block.institution.id,
        amount_krw: amount,
        expense_krw: parseOptionalAmount(block.expense),
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

  const startEditing = (p: FeePayment) => {
    setEditingId(p.id);
    setEditInstitution(
      p.institution
        ? { id: p.institution.id, name_en: p.institution.name_en, name_ko: p.institution.name_ko, city_ko: p.institution.city_ko, is_partner: false }
        : null,
    );
    setEditAmount(String(p.amount_krw));
    setEditExpense(p.expense_krw !== null ? String(p.expense_krw) : '');
    setEditReceipt(p.receipt_url ? { url: p.receipt_url, fileName: p.receipt_file_name ?? 'chek' } : null);
  };

  const cancelEditing = () => setEditingId(null);

  const saveEdit = async (p: FeePayment) => {
    const amount = Number(editAmount);
    if (!editInstitution || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Universitet va summa to'ldirilsin", variant: 'destructive' });
      return;
    }
    try {
      await updatePayment.mutateAsync({
        id: p.id,
        studentId: p.student_id,
        update: {
          institution_id: editInstitution.id,
          amount_krw: amount,
          expense_krw: parseOptionalAmount(editExpense),
          receipt_url: editReceipt?.url ?? null,
          receipt_file_name: editReceipt?.fileName ?? null,
        },
      });
      toast({ title: 'Yangilandi' });
      setEditingId(null);
    } catch (err) {
      toast({
        title: "Yangilab bo'lmadi",
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const removePayment = async (p: FeePayment) => {
    if (!window.confirm("Bu to'lovni o'chirasizmi?")) return;
    try {
      await deletePayment.mutateAsync({ id: p.id, studentId: p.student_id });
      toast({ title: "O'chirildi" });
      if (editingId === p.id) setEditingId(null);
    } catch (err) {
      toast({
        title: "O'chirib bo'lmadi",
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
        if (!o) {
          setAdding(false);
          setEditingId(null);
        }
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
                  <FeeBlockFields
                    institution={block.institution}
                    amount={block.amount}
                    expense={block.expense}
                    receipt={block.receipt}
                    studentId={studentId ?? 'unknown'}
                    onPickInstitution={() => setPickerTarget({ type: 'block', key: block.key })}
                    onAmountChange={(amount) => updateBlock(block.key, { amount })}
                    onExpenseChange={(expense) => updateBlock(block.key, { expense })}
                    onReceiptChange={(receipt) => updateBlock(block.key, { receipt })}
                  />
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
                {payments.map((p) =>
                  editingId === p.id ? (
                    <li key={p.id} className="space-y-2 p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start">
                        <FeeBlockFields
                          institution={editInstitution}
                          amount={editAmount}
                          expense={editExpense}
                          receipt={editReceipt}
                          studentId={p.student_id}
                          onPickInstitution={() => setPickerTarget({ type: 'edit' })}
                          onAmountChange={setEditAmount}
                          onExpenseChange={setEditExpense}
                          onReceiptChange={setEditReceipt}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="justify-self-end text-muted-foreground sm:mt-5"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removePayment(p)}
                          disabled={deletePayment.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          O'chirish
                        </Button>
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={cancelEditing}>
                            Bekor qilish
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveEdit(p)}
                            disabled={updatePayment.isPending}
                          >
                            {updatePayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Yangilash
                          </Button>
                        </div>
                      </div>
                    </li>
                  ) : (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {p.institution?.name_en || p.institution?.name_ko || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString('uz-UZ')}
                          {p.expense_krw !== null && ` · Chiqim: ${formatWon(p.expense_krw)}`}
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
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="successSoft">{formatWon(p.amount_krw)}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => startEditing(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ),
                )}
              </ol>
            </div>
          )}
        </div>

        <InstitutionPickerDialog
          open={pickerTarget !== null}
          onOpenChange={(o) => !o && closePicker()}
          onPick={(inst) => {
            if (pickerTarget?.type === 'block') updateBlock(pickerTarget.key, { institution: inst });
            else if (pickerTarget?.type === 'edit') setEditInstitution(inst);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
