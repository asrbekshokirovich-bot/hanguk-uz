-- Add receipt_url column to payment_transactions table for storing receipt images
ALTER TABLE public.payment_transactions ADD COLUMN receipt_url TEXT;

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', true);

-- Allow anyone to view receipts (they are public)
CREATE POLICY "Payment receipts are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-receipts');

-- Allow authenticated users to upload receipts
CREATE POLICY "Authenticated users can upload payment receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-receipts' AND auth.role() = 'authenticated');

-- Allow authenticated users to update/delete their receipts
CREATE POLICY "Authenticated users can update payment receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'payment-receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete payment receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'payment-receipts' AND auth.role() = 'authenticated');