-- Application fee — "chiqim": universitetga haqiqatda jo'natilgan summa,
-- talabadan yig'ilgan "Summa"dan (amount_krw) farq qilishi mumkin (masalan
-- xizmat haqi yoki kurs farqi tufayli). Ixtiyoriy — to'lov qo'shilganda hali
-- ma'lum bo'lmasligi mumkin, keyinroq tahrirlab kiritiladi.

ALTER TABLE public.application_fee_payments
  ADD COLUMN expense_krw numeric CHECK (expense_krw IS NULL OR expense_krw >= 0);

COMMENT ON COLUMN public.application_fee_payments.expense_krw IS
  'Universitetga haqiqatda jo''natilgan summa (chiqim). amount_krw — talabadan yig''ilgan summa; ikkisi farq qilishi mumkin.';
