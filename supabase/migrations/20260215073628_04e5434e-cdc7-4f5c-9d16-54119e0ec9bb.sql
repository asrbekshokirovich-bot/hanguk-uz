
-- Create university_announcements table
CREATE TABLE public.university_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.university_rooms(id) ON DELETE CASCADE,
  posted_by UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  attachment_url TEXT,
  attachment_name TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.university_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view announcements"
  ON public.university_announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      JOIN public.university_rooms ur ON ur.id = university_announcements.room_id
      WHERE rm.room_id = ur.id AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage announcements"
  ON public.university_announcements FOR ALL
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'university_staff'::app_role)
  );

-- Create university_staff_assignments table
CREATE TABLE public.university_staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, university_id)
);

ALTER TABLE public.university_staff_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "University staff can view own assignments"
  ON public.university_staff_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage staff assignments"
  ON public.university_staff_assignments FOR ALL
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Allow university staff to view applications for their assigned university
CREATE POLICY "University staff can view their university applications"
  ON public.applications FOR SELECT
  USING (
    has_role(auth.uid(), 'university_staff'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.university_staff_assignments usa
      WHERE usa.user_id = auth.uid()
        AND usa.university_id = applications.university_id
        AND usa.is_active = true
    )
  );

-- Allow university staff to view documents for students applying to their university
CREATE POLICY "University staff can view applicant documents"
  ON public.documents FOR SELECT
  USING (
    has_role(auth.uid(), 'university_staff'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.university_staff_assignments usa ON usa.university_id = a.university_id
      WHERE a.student_id = documents.student_id
        AND usa.user_id = auth.uid()
        AND usa.is_active = true
    )
  );

-- Enable realtime for announcements
ALTER PUBLICATION supabase_realtime ADD TABLE public.university_announcements;
