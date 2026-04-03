CREATE TABLE IF NOT EXISTS public.student_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, university_id)
);

ALTER TABLE public.student_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own suggestions"
ON public.student_suggestions FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Staff can manage suggestions"
ON public.student_suggestions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('admin', 'counselor')
    )
);
