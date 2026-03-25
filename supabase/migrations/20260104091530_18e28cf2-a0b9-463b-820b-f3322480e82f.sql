-- Create student_notes table for tracking notes about students
CREATE TABLE public.student_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on student_notes
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for student_notes
CREATE POLICY "Staff can view all student notes"
ON public.student_notes FOR SELECT
USING (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'call_operator') OR 
    has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Staff can create student notes"
ON public.student_notes FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'call_operator') OR 
    has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Users can delete their own notes"
ON public.student_notes FOR DELETE
USING (created_by = auth.uid());

-- Create student_comments table for team comments on students
CREATE TABLE public.student_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on student_comments
ALTER TABLE public.student_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for student_comments
CREATE POLICY "Staff can view all student comments"
ON public.student_comments FOR SELECT
USING (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'call_operator') OR 
    has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Staff can create student comments"
ON public.student_comments FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'call_operator') OR 
    has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Users can delete their own comments"
ON public.student_comments FOR DELETE
USING (created_by = auth.uid());

-- Add gateway_fee column to payment_transactions for tracking fees
ALTER TABLE public.payment_transactions 
ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC DEFAULT 0;

-- Add trigger for updated_at on student_notes
CREATE TRIGGER update_student_notes_updated_at
BEFORE UPDATE ON public.student_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();