
-- Issue 1: Add trigger to insert university staff into room_members when assigned
CREATE OR REPLACE FUNCTION public.handle_university_staff_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_room_id UUID;
BEGIN
  -- Find the university room for this assignment
  SELECT id INTO v_room_id FROM public.university_rooms 
  WHERE university_id = NEW.university_id AND is_active = true
  LIMIT 1;
  
  IF v_room_id IS NOT NULL THEN
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (v_room_id, NEW.user_id, 'university_staff')
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_university_staff_assigned
AFTER INSERT ON public.university_staff_assignments
FOR EACH ROW
EXECUTE FUNCTION public.handle_university_staff_assignment();

-- Issue 1 continued: Update channel_messages INSERT policy to include university_staff
-- First drop existing INSERT policy, then recreate with university_staff included
DROP POLICY IF EXISTS "Room members can send messages" ON public.channel_messages;

CREATE POLICY "Room members can send messages" ON public.channel_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM room_channels rc
    JOIN room_members rm ON rm.room_id = rc.room_id
    WHERE rc.id = channel_messages.channel_id
      AND rm.user_id = auth.uid()
  )
);

-- Issue 2: Tighten university_announcements policies
DROP POLICY IF EXISTS "Staff can manage announcements" ON public.university_announcements;

CREATE POLICY "Staff can manage announcements" ON public.university_announcements
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'university_staff'::app_role) AND
  EXISTS (
    SELECT 1 FROM university_rooms ur
    JOIN university_staff_assignments usa ON usa.university_id = ur.university_id
    WHERE ur.id = university_announcements.room_id
      AND usa.user_id = auth.uid()
      AND usa.is_active = true
  )
)
WITH CHECK (
  has_role(auth.uid(), 'university_staff'::app_role) AND
  EXISTS (
    SELECT 1 FROM university_rooms ur
    JOIN university_staff_assignments usa ON usa.university_id = ur.university_id
    WHERE ur.id = university_announcements.room_id
      AND usa.user_id = auth.uid()
      AND usa.is_active = true
  )
);

-- Also allow agency staff (owner/admin) to manage announcements
CREATE POLICY "Agency staff can manage announcements" ON public.university_announcements
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Issue 8: Add updated_at trigger for university_announcements
CREATE TRIGGER update_university_announcements_updated_at
BEFORE UPDATE ON public.university_announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
