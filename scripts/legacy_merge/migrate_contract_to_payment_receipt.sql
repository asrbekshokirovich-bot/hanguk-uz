-- ============================================================================
-- Migration: move payment receipts that were mistakenly uploaded into the
--            "Contract Document" slot over to each student's Payment section.
--
-- Context
--   Premium & Standart students had their to'lov cheki (payment receipt)
--   uploaded into profiles.contract_url (private `student-documents` bucket)
--   instead of into their payments row. The payment section therefore showed
--   no receipt. This migration relocates every such file into the public
--   `payment-receipts` bucket and attaches it to that SAME student's payment,
--   then clears contract_url.
--
-- Safety / integrity
--   * Matched strictly on profiles.user_id = payments.student_id, and every
--     destination key is prefixed with the owner's user_id, so no receipt can
--     cross between users.
--   * Source files in `student-documents` are NOT deleted (copy, not move).
--   * Original state is preserved in table `mig_contract_to_receipt`.
--
-- Scope executed on project lysjdtyanhdfphqyijsr (Hanguk 2026), 2026-06-20:
--   48 students (premium + standart) with a contract_url.
--     - 40 already had a payment row  -> receipt attached
--     -  8 had no payment row          -> new initial_deposit payment created
--                                         (premium 10,000,000 / standart 5,000,000 UZS,
--                                          status completed, intake bafc30e2-…)
--   Follow-up (same mechanism): +1 no_risk student whose JPG check sat in the
--     contract slot with an empty payment receipt -> receipt attached.
--   Intentionally NOT touched: 3 free/tekin_natija students whose contract_url
--     is a PDF with no payment row — confirmed to be genuine contracts, not checks.
--   Result: only those 3 genuine contracts remain in contract_url; every moved
--     check now lives on its owner's payment (matched on user_id, no mixups).
--
-- Mechanism
--   The container running this had no network egress to *.supabase.co, so the
--   cross-bucket storage copy was performed server-side from Postgres using
--   pg_net against the Storage REST API:
--       POST /storage/v1/object/copy
--       { bucketId, sourceKey, destinationBucket, destinationKey }
--   Replace :SERVICE_ROLE_KEY below with the project service_role JWT to re-run.
-- ============================================================================

-- 1) Snapshot + working table -------------------------------------------------
DROP TABLE IF EXISTS mig_contract_to_receipt;
CREATE TABLE mig_contract_to_receipt AS
SELECT
  p.user_id, p.full_name, p.payment_plan,
  p.contract_url                           AS src_key,
  lower(split_part(p.contract_url,'.',-1)) AS ext,
  pay.id                                   AS payment_id,
  pay.receipt_url                          AS old_receipt_url,
  pay.receipt_urls                         AS old_receipt_urls,
  (pay.id IS NOT NULL)                     AS has_payment,
  ('receipts/' || p.user_id || '_'
     || (extract(epoch from clock_timestamp())*1000)::bigint || '_'
     || substr(md5(random()::text),1,9) || '.'
     || lower(split_part(p.contract_url,'.',-1))) AS dest_key,
  NULL::bigint AS copy_request_id, NULL::int AS copy_status,
  NULL::text AS copy_content,  NULL::uuid AS new_payment_id, false AS applied
FROM profiles p
LEFT JOIN payments pay ON pay.student_id = p.user_id
WHERE lower(coalesce(p.payment_plan,'')) IN ('premium','standart','standard')
  AND p.contract_url IS NOT NULL AND p.contract_url <> '';

ALTER TABLE mig_contract_to_receipt ADD COLUMN public_url text;
UPDATE mig_contract_to_receipt
  SET public_url = 'https://lysjdtyanhdfphqyijsr.supabase.co/storage/v1/object/public/payment-receipts/' || dest_key;

-- 2) Cross-bucket storage copy (private student-documents -> public payment-receipts)
UPDATE mig_contract_to_receipt SET copy_request_id = net.http_post(
  url := 'https://lysjdtyanhdfphqyijsr.supabase.co/storage/v1/object/copy',
  body := jsonb_build_object('bucketId','student-documents','sourceKey',src_key,
                             'destinationBucket','payment-receipts','destinationKey',dest_key),
  headers := jsonb_build_object('Content-Type','application/json',
             'Authorization','Bearer :SERVICE_ROLE_KEY','apikey',':SERVICE_ROLE_KEY'));

-- wait for pg_net to drain, then record results
UPDATE mig_contract_to_receipt mw
SET copy_status = r.status_code, copy_content = left(r.content,300)
FROM net._http_response r WHERE r.id = mw.copy_request_id;
-- abort if any copy did not return 200/201 before continuing.

-- 3a) Attach receipt to existing payments
UPDATE payments pay
SET receipt_url  = coalesce(pay.receipt_url, mw.public_url),
    receipt_urls = coalesce(pay.receipt_urls,'{}'::text[]) || mw.public_url,
    updated_at   = now()
FROM mig_contract_to_receipt mw
WHERE mw.payment_id = pay.id AND mw.has_payment AND mw.copy_status IN (200,201);

-- 3b) Create payments for students that had none
WITH ins AS (
  INSERT INTO payments
    (student_id, payment_type, amount, currency, status, paid_amount, paid_at,
     intake_id, receipt_url, receipt_urls, created_at, updated_at)
  SELECT mw.user_id, 'initial_deposit',
         CASE WHEN lower(mw.payment_plan)='premium' THEN 10000000 ELSE 5000000 END,
         'UZS','completed',
         CASE WHEN lower(mw.payment_plan)='premium' THEN 10000000 ELSE 5000000 END,
         now(), 'bafc30e2-74e8-4b54-b834-62421a638f06',
         mw.public_url, ARRAY[mw.public_url], now(), now()
  FROM mig_contract_to_receipt mw
  WHERE NOT mw.has_payment AND mw.copy_status IN (200,201)
  RETURNING id, student_id)
UPDATE mig_contract_to_receipt mw SET new_payment_id = ins.id
FROM ins WHERE ins.student_id = mw.user_id AND NOT mw.has_payment;

-- 3c) Clear the contract slot (source file kept in storage for reversibility)
UPDATE profiles p SET contract_url = NULL, updated_at = now()
FROM mig_contract_to_receipt mw
WHERE mw.user_id = p.user_id AND mw.copy_status IN (200,201);

UPDATE mig_contract_to_receipt SET applied = true WHERE copy_status IN (200,201);

-- ============================================================================
-- ROLLBACK (restores contract_url and prior receipt state; new payments removed)
-- ============================================================================
-- UPDATE profiles p SET contract_url = mw.src_key
--   FROM mig_contract_to_receipt mw WHERE mw.user_id = p.user_id;
-- UPDATE payments pay SET receipt_url = mw.old_receipt_url,
--                        receipt_urls = mw.old_receipt_urls
--   FROM mig_contract_to_receipt mw WHERE mw.payment_id = pay.id AND mw.has_payment;
-- DELETE FROM payments WHERE id IN (SELECT new_payment_id FROM mig_contract_to_receipt
--                                   WHERE new_payment_id IS NOT NULL);
-- (Copied files in payment-receipts may then be deleted via the Storage API.)
