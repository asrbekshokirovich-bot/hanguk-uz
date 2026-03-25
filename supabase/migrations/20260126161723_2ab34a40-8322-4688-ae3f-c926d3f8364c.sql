-- Create staff_bonuses table for tracking bonuses per student contract
CREATE TABLE public.staff_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  staff_user_id UUID, -- The staff member assigned to receive this bonus (null = unassigned)
  plan_type TEXT NOT NULL, -- standart, premium, no_risk
  bonus_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UZS',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, assigned, paid
  assigned_at TIMESTAMP WITH TIME ZONE,
  assigned_by UUID, -- The owner who assigned this bonus
  paid_at TIMESTAMP WITH TIME ZONE,
  month_year TEXT, -- Format: YYYY-MM for monthly aggregation
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_bonuses ENABLE ROW LEVEL SECURITY;

-- Only owners can view bonuses
CREATE POLICY "Owners can view all bonuses"
ON public.staff_bonuses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Only owners can insert bonuses
CREATE POLICY "Owners can insert bonuses"
ON public.staff_bonuses
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Only owners can update bonuses (assign staff, mark as paid)
CREATE POLICY "Owners can update bonuses"
ON public.staff_bonuses
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Only owners can delete bonuses
CREATE POLICY "Owners can delete bonuses"
ON public.staff_bonuses
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Create index for efficient queries
CREATE INDEX idx_staff_bonuses_student_id ON public.staff_bonuses(student_id);
CREATE INDEX idx_staff_bonuses_staff_user_id ON public.staff_bonuses(staff_user_id);
CREATE INDEX idx_staff_bonuses_month_year ON public.staff_bonuses(month_year);
CREATE INDEX idx_staff_bonuses_status ON public.staff_bonuses(status);

-- Create trigger for updating updated_at
CREATE TRIGGER update_staff_bonuses_updated_at
BEFORE UPDATE ON public.staff_bonuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();