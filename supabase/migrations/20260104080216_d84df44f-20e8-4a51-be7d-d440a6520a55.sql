-- Create payments table for tracking student payments
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('initial_deposit', 'remaining_payment', 'other')),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'overdue', 'refunded')),
  paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  invoice_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment_transactions table for tracking individual transactions
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT,
  transaction_reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Staff can view all payments"
ON public.payments
FOR SELECT
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin')
);

CREATE POLICY "Staff can manage payments"
ON public.payments
FOR ALL
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin')
);

CREATE POLICY "Students can view their own payments"
ON public.payments
FOR SELECT
USING (auth.uid() = student_id);

-- RLS Policies for payment_transactions
CREATE POLICY "Staff can view all transactions"
ON public.payment_transactions
FOR SELECT
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin')
);

CREATE POLICY "Staff can manage transactions"
ON public.payment_transactions
FOR ALL
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin')
);

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate invoice number
CREATE TRIGGER generate_payment_invoice_number
BEFORE INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_number();