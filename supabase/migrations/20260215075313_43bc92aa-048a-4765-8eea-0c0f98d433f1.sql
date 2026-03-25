
-- Issue A: Attach trigger to auto-add staff to room_members on assignment
CREATE TRIGGER on_staff_assignment
  AFTER INSERT ON public.university_staff_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_university_staff_assignment();

-- Issue B: Attach updated_at trigger on university_announcements
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.university_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Issue F: Update channel_messages INSERT policy to include university_staff
-- First drop then recreate with university_staff included
DROP POLICY IF EXISTS "Members can send messages to discussion channels" ON public.channel_messages;

CREATE POLICY "Members can send messages to discussion channels"
  ON public.channel_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.room_channels rc
        WHERE rc.id = channel_id AND rc.channel_type = 'discussion'
      )
      OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'call_operator'::app_role)
      OR has_role(auth.uid(), 'document_handler'::app_role)
      OR has_role(auth.uid(), 'university_staff'::app_role)
    )
    AND EXISTS (
      SELECT 1 FROM public.room_members rm
      JOIN public.room_channels rc ON rc.room_id = rm.room_id
      WHERE rc.id = channel_id AND rm.user_id = auth.uid()
    )
  );
