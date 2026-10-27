import { describe, expect, it } from 'vitest';
import {
  MAX_FEE_RECEIPTS,
  addReceipts,
  isMissingRelationError,
  legacyReceiptColumns,
  receiptsForPayment,
} from '../applicationFeeReceipts';

const r = (n: number) => ({ url: `https://x/chek${n}.jpg`, fileName: `chek${n}.jpg` });

describe('receiptsForPayment', () => {
  it('yangi jadvaldagi barcha cheklarni qaytaradi', () => {
    const list = receiptsForPayment(
      { receipt_url: 'https://x/chek1.jpg', receipt_file_name: 'chek1.jpg' },
      [
        { url: 'https://x/chek1.jpg', file_name: 'chek1.jpg' },
        { url: 'https://x/chek2.jpg', file_name: null },
      ],
    );
    expect(list).toEqual([r(1), { url: 'https://x/chek2.jpg', fileName: 'chek' }]);
  });

  it("jadvalda qator bo'lmasa eski ustundagi bitta chekka qaytadi", () => {
    expect(receiptsForPayment({ receipt_url: 'https://x/chek1.jpg', receipt_file_name: null }, undefined)).toEqual([
      { url: 'https://x/chek1.jpg', fileName: 'chek' },
    ]);
    expect(receiptsForPayment({ receipt_url: 'https://x/chek1.jpg', receipt_file_name: 'a.jpg' }, [])).toEqual([
      { url: 'https://x/chek1.jpg', fileName: 'a.jpg' },
    ]);
  });

  it("chek bo'lmasa bo'sh ro'yxat", () => {
    expect(receiptsForPayment({ receipt_url: null, receipt_file_name: null }, undefined)).toEqual([]);
  });
});

describe('legacyReceiptColumns', () => {
  it('eski ustunlarga birinchi chek yoziladi', () => {
    expect(legacyReceiptColumns([r(1), r(2)])).toEqual({ receipt_url: r(1).url, receipt_file_name: r(1).fileName });
    expect(legacyReceiptColumns([])).toEqual({ receipt_url: null, receipt_file_name: null });
  });
});

describe('addReceipts', () => {
  it("yangi cheklarni oxiriga qo'shadi va takrorni tashlab ketadi", () => {
    expect(addReceipts([r(1)], [r(1), r(2), r(3)])).toEqual([r(1), r(2), r(3)]);
  });

  it(`eng ko'pi ${MAX_FEE_RECEIPTS} ta`, () => {
    const many = Array.from({ length: MAX_FEE_RECEIPTS + 3 }, (_, i) => r(i));
    expect(addReceipts([], many)).toHaveLength(MAX_FEE_RECEIPTS);
  });
});

describe('isMissingRelationError', () => {
  it("jadval yo'qligini taniydi", () => {
    expect(isMissingRelationError({ code: 'PGRST205', message: 'x' })).toBe(true);
    expect(isMissingRelationError({ code: '42P01', message: 'x' })).toBe(true);
    expect(
      isMissingRelationError({
        message: "Could not find the table 'public.application_fee_receipts' in the schema cache",
      }),
    ).toBe(true);
  });

  it('boshqa xatolarni yutmaydi', () => {
    expect(isMissingRelationError({ code: '42501', message: 'permission denied for table application_fee_receipts' })).toBe(false);
    expect(isMissingRelationError(null)).toBe(false);
  });
});
