-- Add receipt_urls array column for multiple receipts
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS receipt_urls TEXT[] DEFAULT '{}';

-- Migrate existing receipt_url values to the new array column
UPDATE public.payment_transactions 
SET receipt_urls = ARRAY[receipt_url]
WHERE receipt_url IS NOT NULL AND receipt_url != '' AND (receipt_urls IS NULL OR receipt_urls = '{}');