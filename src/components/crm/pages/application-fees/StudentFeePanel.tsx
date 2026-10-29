import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X, GraduationCap, Pencil, Trash2 } from 'lucide-react';
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
  receipts: FeeReceipt[];
}

const newBlock = (): FeeBlock => ({
  key: crypto.randomUUID(),
  institution: null,
  amount: '',
  expense: '',
  receipts: [],
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
  receipts,
  studentId,
  onPickInstitution,
  onAmountChange,
  onExpenseChange,
  onReceiptChange,
}: {
  institution: { name_en: string | null; name_ko: string } | null;
  amount: string;
  expense: string;
  receipts: FeeReceipt[];
  studentId: string;
  onPickInstitution: () => void;
  onAmountChange: (value: string) => void;
  onExpenseChange: (value: string) => void;
  onReceiptChange: (receipts: FeeReceipt[]) => void;
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
        <p className="text-xs text-muted-foreground">Cheklar</p>
        <FeeReceiptUpload value={receipts} onChange={onReceiptChange} studentId={studentId} />
      </div>
    </>
  );
}

interface Props {
  studentId: string;
}

type PickerTarget = { type: 'block'; key: string } | { type: 'edit' } | null;

/**
 * "Application fee" bloki — Universitet tanlash sahifasidagi tanlangan talaba
 * kartochkasi ichida: mavjud application fee to'lovlari (tahrirlash/o'chirish
 * bilan) + "App fee qo'shish" — universitet, summa (KRW) va chekdan iborat
 * xohlagancha blok qo'shib, birdaniga saqlash.
 *
 * Boshqa talaba tanlanganda qo'shish/tahrirlash holati qolib ketmasligi uchun
 * ota komponent `key={studentId}` beradi.
 */
export function StudentFeePanel({ studentId }: Props) {
  const { payments, loading, error } = useStudentFeePayments(studentId);
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
  const [editReceipts, setEditReceipts] = useState<FeeReceipt[]>([]);

  const startAdding = () => {
    setBlocks([newBlock()]);
    setAdding(true);
  };

  const addBlock = () => setBlocks((b) => [...b, newBlock()]);
  const removeBlock = (key: string) => setBlocks((b) => (b.length <= 1 ? b : b.filter((x) => x.key !== key)));
  const updateBlock = (key: string, patch: Partial<FeeBlock>) =>
    setBlocks((b) => b.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const submit = async () => {
    const entries: FeePaymentInput[] = [];
    for (const block of blocks) {
      const amount = Number(block.amount);
      if (!block.institution || !Number.isFinite(amount) || amount <= 0) continue;
      entries.push({
        institution_id: block.institution.id,
        amount_krw: amount,
        expense_krw: parseOptionalAmount(block.expense),
        receipts: block.receipts,
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
    setEditReceipts(p.receipts);
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
          receipts: editReceipts,
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
    <div data-testid="fee-panel" className="border-t border-border pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">Application fee</h3>
        <div className="flex items-center gap-2">
          {payments.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">{payments.length} ta to'lov</span>
          )}
          {!adding && (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={startAdding}>
              <Plus className="h-3 w-3" />
              App fee qo'shish
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
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
                  receipts={block.receipts}
                  studentId={studentId}
                  onPickInstitution={() => setPickerTarget({ type: 'block', key: block.key })}
                  onAmountChange={(amount) => updateBlock(block.key, { amount })}
                  onExpenseChange={(expense) => updateBlock(block.key, { expense })}
                  onReceiptChange={(receipts) => updateBlock(block.key, { receipts })}
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
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-center text-xs text-destructive">
            To'lovlarni yuklab bo'lmadi: {error.message}
          </p>
        ) : payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Hali to'lov qo'shilmagan
          </p>
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
                        receipts={editReceipts}
                        studentId={p.student_id}
                        onPickInstitution={() => setPickerTarget({ type: 'edit' })}
                        onAmountChange={setEditAmount}
                        onExpenseChange={setEditExpense}
                        onReceiptChange={setEditReceipts}
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
                  <li key={p.id} data-testid="fee-row" className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {p.institution?.name_en || p.institution?.name_ko || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString('uz-UZ')}
                        {p.expense_krw !== null && ` · Chiqim: ${formatWon(p.expense_krw)}`}
                        {p.receipts.length > 0 && (
                          <>
                            {' · '}
                            {p.receipts.length === 1 ? (
                              <a
                                href={p.receipts[0].url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                chek
                              </a>
                            ) : (
                              <>
                                {p.receipts.length} ta chek:{' '}
                                {p.receipts.map((r, i) => (
                                  <a
                                    key={r.url}
                                    href={r.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mr-1 text-primary hover:underline"
                                  >
                                    {i + 1}
                                  </a>
                                ))}
                              </>
                            )}
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
                        aria-label="Tahrirlash"
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
        onOpenChange={(o) => !o && setPickerTarget(null)}
        onPick={(inst) => {
          if (pickerTarget?.type === 'block') updateBlock(pickerTarget.key, { institution: inst });
          else if (pickerTarget?.type === 'edit') setEditInstitution(inst);
        }}
      />
    </div>
  );
}
