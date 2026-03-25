
-- Fix 1: room_members RLS infinite recursion
-- Create a security definer function to break the self-referential SELECT
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = _room_id AND user_id = _user_id
  )
$$;

-- Drop the self-referential policy that causes infinite recursion
DROP POLICY IF EXISTS "Members can view room members" ON public.room_members;

-- Replace with a policy that calls the security definer function instead
CREATE POLICY "Members can view room members" ON public.room_members
  FOR SELECT USING (public.is_room_member(room_id, auth.uid()));

-- Also ensure staff/owners can view all room members (for admin panel)
DROP POLICY IF EXISTS "Staff can view all room members" ON public.room_members;
CREATE POLICY "Staff can view all room members" ON public.room_members
  FOR SELECT USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'document_handler')
  );
