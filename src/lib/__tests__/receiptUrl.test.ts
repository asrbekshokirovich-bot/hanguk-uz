import { describe, expect, it, vi } from 'vitest';

const createSignedUrl = vi.fn(async (path: string) => ({
  data: { signedUrl: `https://x.supabase.co/storage/v1/object/sign/payment-receipts/${path}?token=t` },
  error: null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl }) } },
}));

import { receiptPath, signReceiptUrl } from '../receiptUrl';

const PUBLIC =
  'https://lysjdtyanhdfphqyijsr.supabase.co/storage/v1/object/public/payment-receipts/receipts/abc_1730000000000.jpg';

describe('receiptPath', () => {
  it('extracts the path from a stored public URL', () => {
    expect(receiptPath(PUBLIC)).toBe('receipts/abc_1730000000000.jpg');
  });

  it('extracts the path from a signed URL and decodes it', () => {
    expect(
      receiptPath('https://h/storage/v1/object/sign/payment-receipts/application-fees/a%20b.pdf?token=1'),
    ).toBe('application-fees/a b.pdf');
  });

  it('accepts a bare bucket path', () => {
    expect(receiptPath('application-fees/x.png')).toBe('application-fees/x.png');
  });

  it('ignores other buckets and empty values', () => {
    expect(receiptPath('https://h/storage/v1/object/public/avatars/a.png')).toBeNull();
    expect(receiptPath(null)).toBeNull();
    expect(receiptPath('')).toBeNull();
  });
});

describe('signReceiptUrl', () => {
  it('signs receipt URLs and caches them', async () => {
    createSignedUrl.mockClear();
    const a = await signReceiptUrl(PUBLIC);
    const b = await signReceiptUrl(PUBLIC);
    expect(a).toContain('/object/sign/payment-receipts/receipts/abc_1730000000000.jpg');
    expect(b).toBe(a);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('returns non-receipt values unchanged', async () => {
    expect(await signReceiptUrl('https://example.com/file.pdf')).toBe('https://example.com/file.pdf');
  });
});
