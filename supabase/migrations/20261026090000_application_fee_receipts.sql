-- Application fee: bitta to'lovga bir nechta chek.
--
-- application_fee_payments.receipt_url / receipt_file_name faqat BITTA chekni
-- saqlaydi. Talaba ariza to'lovini bo'lib to'lasa yoki bank ikkita chek bersa,
-- ikkinchisini qo'shib bo'lmasdi. Cheklar endi alohida jadvalda: bir to'lovga
-- xohlagancha qator.
--
-- Eski ustunlar orqaga moslik uchun qoldiriladi: CRM birinchi chekni ularga
-- ham yozadi, shuning uchun bu migratsiyadan oldingi kod va hisobotlar
-- buzilmaydi.

CREATE TABLE IF NOT EXISTS public.application_fee_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.application_fee_payments(id) ON DELETE CASCADE,
  url text NOT NULL,
  file_name text,
  created_by uuid REFERENCES public.profiles(user_id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.application_fee_receipts IS
  'Receipt files (cheklar) for an application_fee_payments row — any number per payment.';

CREATE INDEX IF NOT EXISTS application_fee_receipts_payment_idx
  ON public.application_fee_receipts (payment_id);

ALTER TABLE public.application_fee_receipts ENABLE ROW LEVEL SECURITY;

-- Kim ko'radi/yozadi — to'lovning o'zi bilan bir xil (can_edit_application_fees()).
DROP POLICY IF EXISTS application_fee_receipts_read ON public.application_fee_receipts;
CREATE POLICY application_fee_receipts_read ON public.application_fee_receipts
  FOR SELECT TO authenticated
  USING (public.can_edit_application_fees());

DROP POLICY IF EXISTS application_fee_receipts_write ON public.application_fee_receipts;
CREATE POLICY application_fee_receipts_write ON public.application_fee_receipts
  FOR ALL TO authenticated
  USING (public.can_edit_application_fees())
  WITH CHECK (public.can_edit_application_fees());

-- Mavjud cheklarni ko'chirish. Qayta ishga tushirilsa takrorlamaydi.
INSERT INTO public.application_fee_receipts (payment_id, url, file_name, created_by, created_at)
SELECT p.id, p.receipt_url, p.receipt_file_name, p.created_by, p.created_at
FROM public.application_fee_payments p
WHERE p.receipt_url IS NOT NULL
  AND btrim(p.receipt_url) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.application_fee_receipts r
    WHERE r.payment_id = p.id AND r.url = p.receipt_url
  );
