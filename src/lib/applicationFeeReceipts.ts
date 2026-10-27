/**
 * Application fee cheklari — bitta to'lovga bir nechta fayl.
 *
 * Cheklar `application_fee_receipts` jadvalida (migratsiya
 * 20261026090000_application_fee_receipts.sql). Eski
 * `application_fee_payments.receipt_url` / `receipt_file_name` ustunlari
 * orqaga moslik uchun qoladi: ularga doim birinchi chek yoziladi.
 */

export interface FeeReceipt {
  url: string;
  fileName: string;
}

/** Bitta to'lovga biriktiriladigan cheklarning eng ko'p soni. */
export const MAX_FEE_RECEIPTS = 10;

/**
 * Jadval hali bazada yo'qligini bildiradigan xato (migratsiya qo'llanmagan).
 * PostgREST uni `PGRST205` ("schema cache"da yo'q) yoki Postgres `42P01`
 * sifatida qaytaradi.
 */
export function isMissingRelationError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === 'PGRST205' || err.code === '42P01') return true;
  const msg = (err.message ?? '').toLowerCase();
  return (
    msg.includes('application_fee_receipts') &&
    (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find'))
  );
}

/** Eski ustunlarga yoziladigan qiymat — ro'yxatdagi birinchi chek. */
export function legacyReceiptColumns(receipts: FeeReceipt[]): {
  receipt_url: string | null;
  receipt_file_name: string | null;
} {
  const first = receipts[0];
  return { receipt_url: first?.url ?? null, receipt_file_name: first?.fileName ?? null };
}

/**
 * To'lovning cheklar ro'yxati: yangi jadvalda qator bo'lsa — o'sha,
 * bo'lmasa (eski yozuv yoki migratsiya hali qo'llanmagan) — eski ustundagi
 * bitta chek.
 */
export function receiptsForPayment(
  legacy: { receipt_url: string | null; receipt_file_name: string | null },
  rows: { url: string; file_name: string | null }[] | undefined,
): FeeReceipt[] {
  if (rows && rows.length > 0) {
    return rows.map((r) => ({ url: r.url, fileName: r.file_name ?? 'chek' }));
  }
  if (legacy.receipt_url) {
    return [{ url: legacy.receipt_url, fileName: legacy.receipt_file_name ?? 'chek' }];
  }
  return [];
}

/** Bir xil faylni ikki marta qo'shmaslik uchun (URL bo'yicha). */
export function addReceipts(current: FeeReceipt[], added: FeeReceipt[]): FeeReceipt[] {
  const seen = new Set(current.map((r) => r.url));
  const next = [...current];
  for (const r of added) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    next.push(r);
  }
  return next.slice(0, MAX_FEE_RECEIPTS);
}

export const RECEIPTS_MIGRATION_MISSING_MESSAGE =
  "Bir nechta chek saqlash uchun bazaga yangilanish (application_fee_receipts) hali qo'llanmagan. " +
  "Hozircha bitta chek bilan saqlang yoki administratorga murojaat qiling.";
