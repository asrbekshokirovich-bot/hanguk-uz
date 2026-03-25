-- Create income distribution settings table
CREATE TABLE public.income_distribution_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_name TEXT NOT NULL,
    percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    recipient_type TEXT NOT NULL DEFAULT 'owner' CHECK (recipient_type IN ('owner', 'charity', 'other')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create income distribution records table (tracks actual distributions)
CREATE TABLE public.income_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.income_distribution_settings(id) ON DELETE SET NULL,
    recipient_name TEXT NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    base_amount NUMERIC NOT NULL, -- Amount after operational fund deduction
    distributed_amount NUMERIC NOT NULL,
    distribution_month TEXT NOT NULL, -- yyyy-MM format
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.income_distribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_distributions ENABLE ROW LEVEL SECURITY;

-- RLS policies for income_distribution_settings
CREATE POLICY "Staff can view income distribution settings"
ON public.income_distribution_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can manage income distribution settings"
ON public.income_distribution_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- RLS policies for income_distributions
CREATE POLICY "Owners can view income distributions"
ON public.income_distributions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can manage income distributions"
ON public.income_distributions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Insert default distribution settings
INSERT INTO public.income_distribution_settings (recipient_name, percentage, recipient_type) VALUES
('Asrbek', 47.5, 'owner'),
('Mukhsin', 47.5, 'owner'),
('Charity', 5, 'charity');

-- Add trigger for updated_at
CREATE TRIGGER update_income_distribution_settings_updated_at
BEFORE UPDATE ON public.income_distribution_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();