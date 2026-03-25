-- Monthly Payment Categories - stores recurring operational expenses
CREATE TABLE public.monthly_payment_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_type TEXT NOT NULL DEFAULT 'other' CHECK (category_type IN ('salary', 'rent', 'utilities', 'other')),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'UZS',
  recipient_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Operational Fund Settings - owner-configurable amount per student
CREATE TABLE public.operational_fund_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amount_per_student NUMERIC NOT NULL DEFAULT 2000000,
  currency TEXT NOT NULL DEFAULT 'UZS',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default settings row
INSERT INTO public.operational_fund_settings (amount_per_student, currency) 
VALUES (2000000, 'UZS');

-- Operational Fund Allocations - tracks distributions from student payments
CREATE TABLE public.operational_fund_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.monthly_payment_categories(id) ON DELETE CASCADE,
  allocated_amount NUMERIC NOT NULL DEFAULT 0,
  allocation_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'allocated' CHECK (status IN ('allocated', 'spent', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.monthly_payment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_fund_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_fund_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for monthly_payment_categories (owner only)
CREATE POLICY "Owners can view monthly payment categories"
ON public.monthly_payment_categories FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert monthly payment categories"
ON public.monthly_payment_categories FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update monthly payment categories"
ON public.monthly_payment_categories FOR UPDATE
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete monthly payment categories"
ON public.monthly_payment_categories FOR DELETE
USING (public.has_role(auth.uid(), 'owner'));

-- RLS Policies for operational_fund_settings (owner only)
CREATE POLICY "Owners can view operational fund settings"
ON public.operational_fund_settings FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update operational fund settings"
ON public.operational_fund_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'owner'));

-- RLS Policies for operational_fund_allocations (owner only)
CREATE POLICY "Owners can view operational fund allocations"
ON public.operational_fund_allocations FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert operational fund allocations"
ON public.operational_fund_allocations FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update operational fund allocations"
ON public.operational_fund_allocations FOR UPDATE
USING (public.has_role(auth.uid(), 'owner'));

-- Indexes for performance
CREATE INDEX idx_monthly_payment_categories_active ON public.monthly_payment_categories(is_active);
CREATE INDEX idx_operational_fund_allocations_month ON public.operational_fund_allocations(allocation_month);
CREATE INDEX idx_operational_fund_allocations_student ON public.operational_fund_allocations(student_id);
CREATE INDEX idx_operational_fund_allocations_category ON public.operational_fund_allocations(category_id);

-- Update trigger for monthly_payment_categories
CREATE TRIGGER update_monthly_payment_categories_updated_at
BEFORE UPDATE ON public.monthly_payment_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for operational_fund_settings
CREATE TRIGGER update_operational_fund_settings_updated_at
BEFORE UPDATE ON public.operational_fund_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();