-- Create distribution_transfers table for manual transfers from distribution to monthly operations
CREATE TABLE public.distribution_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_month TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create distribution_transfer_items table to track per-shareholder deductions
CREATE TABLE public.distribution_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID REFERENCES public.distribution_transfers(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  percentage NUMERIC NOT NULL,
  deducted_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.distribution_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_transfer_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for distribution_transfers - authenticated users can read/write
CREATE POLICY "Authenticated users can view distribution transfers"
  ON public.distribution_transfers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create distribution transfers"
  ON public.distribution_transfers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update distribution transfers"
  ON public.distribution_transfers FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete distribution transfers"
  ON public.distribution_transfers FOR DELETE
  TO authenticated
  USING (true);

-- RLS policies for distribution_transfer_items
CREATE POLICY "Authenticated users can view transfer items"
  ON public.distribution_transfer_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create transfer items"
  ON public.distribution_transfer_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update transfer items"
  ON public.distribution_transfer_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete transfer items"
  ON public.distribution_transfer_items FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX idx_distribution_transfers_month ON public.distribution_transfers(transfer_month);
CREATE INDEX idx_distribution_transfer_items_transfer_id ON public.distribution_transfer_items(transfer_id);