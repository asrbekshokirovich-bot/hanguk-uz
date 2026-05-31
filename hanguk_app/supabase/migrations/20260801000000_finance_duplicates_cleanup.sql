-- Finance section duplicate cleanup (atomic).
--
-- Removes ~68 duplicate rows accumulated through the Lovable admin
-- web app (mostly re-saving the same form):
--   * 34 payments + their cascade-linked transactions
--   * 16 unlinked PayMe gateway-fee expenses from 2026-02-03
--   *  3 "Asrbek/owner/47.5%" income_distribution_settings dupes
--   *  7 "Odina opa/salary" monthly_payment_categories dupes
--   *  7 operational_fund_allocations for the same student/category/month
--   *  1 operational_fund_settings row with amount=0 (accidental reset)
--
-- Already applied to the Hanguk 2026 Supabase project on 2026-05-23
-- via the MCP `apply_migration` tool; this file is the source of truth.

-- 1. payments: cascade removes their tx/dist/ofa.
DELETE FROM public.payments WHERE id IN (
  '7c848908-4165-4774-90bb-4037a85b92a2','a17e9a39-8453-45ba-ac0a-00683d3b23e8',
  '58462101-3614-414c-b04d-34b8b8fcc4ca','37ff8d02-5c59-491a-897f-8f4a6562b0c5',
  '25c457b1-828f-4c94-8f44-14271aa722e4','8f7eed83-4894-4a39-b5f0-ff05e0afcfec',
  'dc510bd4-db4e-4f05-92b7-fef77b55cd3e','75429cca-21f4-435a-babd-00edbd183230',
  '3fe7505f-5240-4144-8243-cd5bbf4f1f9f','4bec242f-72ab-479c-b085-95121c091e3a',
  'dea8091f-7a55-48fa-9afd-e5ceaf146956','e4485d3b-bbd1-4dff-bcd0-6f0053a6fed5',
  '05bfad72-5670-4875-a959-aa30eb70df47','009e739c-7b86-4c8e-9449-3854333f375a',
  'c109fb52-7b66-455c-9f05-6dcca1379a77','2576f2bf-6bf2-439a-bee4-3ba63c8a19c2',
  '37fbc51c-9255-4a1b-9305-a1d5e3e93b0f','dee10c6c-48f4-4313-9cd3-9b6f6d9a4c6d',
  '7f053f4d-7392-4c79-a1bd-330367c04028','b55bf741-e628-469b-9ac8-c13eb89dbd6b',
  'eebb82e0-87ee-495b-ada2-5f7a4846ec20','b82f6a5f-09a3-4dbb-8fc9-74a8dfacb6df',
  'e59075bc-dba5-40d6-99ca-10240ad51a40','3f283939-34e1-49f3-9c74-4641e223d6e1',
  '8a188779-f4ba-4e26-be06-949afce290fe','59ab04a8-1ee4-475a-ab17-d47518fc7ef4',
  '1e4b2039-d9b7-400f-bc2c-d2e3840beb2b','12210edb-a693-42cf-a331-a5ec3ffa4164',
  '72a26862-62ca-43b6-bfbe-b0892c8e6f1a','b7b43047-9931-409c-8025-efb0c0ebe324',
  'e7f41e17-5ff8-4fbd-933a-c6f96a5c5b92','6db3b3ba-3782-4740-abe6-551abae9961a',
  'ea782736-2678-42d5-8ae6-bed19d3800f0','6741f9ba-b1b1-46f1-9cc8-06c8ca31bb87'
);

-- 2. expenses: drop 16 of 17 unlinked PayMe "75 000 / 2026-02-03" rows.
WITH ranked_expenses AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY id::text) AS rn
    FROM public.expenses
   WHERE category = 'gateway_fee'
     AND description = 'PayMe to''lov komissiyasi'
     AND amount = 75000
     AND currency = 'UZS'
     AND expense_date = '2026-02-03'
     AND linked_transaction_id IS NULL
)
DELETE FROM public.expenses
 WHERE id IN (SELECT id FROM ranked_expenses WHERE rn > 1);

-- 3. income_distribution_settings: keep 1 of 4 "Asrbek/owner" rows.
WITH ranked_ids AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY recipient_name, recipient_type
           ORDER BY created_at NULLS LAST, id::text
         ) AS rn
    FROM public.income_distribution_settings
)
DELETE FROM public.income_distribution_settings
 WHERE id IN (SELECT id FROM ranked_ids WHERE rn > 1);

-- 4. monthly_payment_categories: keep the row linked to allocations.
DELETE FROM public.monthly_payment_categories
 WHERE name = 'Odina opa '
   AND category_type = 'salary'
   AND id <> 'd01e0788-4749-48fa-8620-50793158af57';

-- 5. operational_fund_allocations: collapse 8 dupes for one student.
WITH ranked_ofa AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, COALESCE(payment_id::text,''), category_id, allocation_month
           ORDER BY created_at NULLS LAST, id::text
         ) AS rn
    FROM public.operational_fund_allocations
)
DELETE FROM public.operational_fund_allocations
 WHERE id IN (SELECT id FROM ranked_ofa WHERE rn > 1);

-- 6. operational_fund_settings: drop the accidental amount=0 row.
DELETE FROM public.operational_fund_settings
 WHERE id = 'd20f72ce-d849-4846-a263-cff1f536ab78'
   AND amount_per_student = 0;
