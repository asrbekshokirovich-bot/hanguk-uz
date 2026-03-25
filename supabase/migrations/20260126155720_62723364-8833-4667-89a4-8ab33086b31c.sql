-- Create scheduled_payments table for automatic payment scheduling
CREATE TABLE public.scheduled_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  payment_type TEXT NOT NULL, -- 'first_payment', 'second_payment', 'other'
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UZS',
  scheduled_date DATE,
  trigger_type TEXT NOT NULL, -- 'contract_based', 'admission_trigger'
  trigger_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'triggered', 'paid', 'cancelled'
  linked_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  triggered_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for staff access
CREATE POLICY "Staff can view all scheduled payments"
  ON public.scheduled_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create scheduled payments"
  ON public.scheduled_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update scheduled payments"
  ON public.scheduled_payments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can delete scheduled payments"
  ON public.scheduled_payments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create index for faster queries
CREATE INDEX idx_scheduled_payments_student_id ON public.scheduled_payments(student_id);
CREATE INDEX idx_scheduled_payments_status ON public.scheduled_payments(status);
CREATE INDEX idx_scheduled_payments_trigger_type ON public.scheduled_payments(trigger_type);

-- Create updated_at trigger
CREATE TRIGGER update_scheduled_payments_updated_at
  BEFORE UPDATE ON public.scheduled_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();