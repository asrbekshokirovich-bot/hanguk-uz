-- Add linked_transaction_id column to expenses table for linking gateway fees to payment transactions
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_expenses_linked_transaction_id ON public.expenses(linked_transaction_id);

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.expenses.linked_transaction_id IS 'Links gateway fee expenses to their source payment transaction for auto-updates';