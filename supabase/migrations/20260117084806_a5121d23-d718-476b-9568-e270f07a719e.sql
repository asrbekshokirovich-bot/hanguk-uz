-- Create university_rooms table (auto-created when student applies)
CREATE TABLE public.university_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(university_id)
);

-- Create room_members table
CREATE TABLE public.room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.university_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'student', -- 'student', 'staff', 'admin'
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Create room_channels table
CREATE TABLE public.room_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.university_rooms(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('discussion', 'announcement')),
  name_uz TEXT NOT NULL,
  name_en TEXT,
  name_ru TEXT,
  name_ko TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create channel_messages table
CREATE TABLE public.channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.room_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create university_events table
CREATE TABLE public.university_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.university_rooms(id) ON DELETE CASCADE,
  title_uz TEXT NOT NULL,
  title_en TEXT,
  title_ru TEXT,
  title_ko TEXT,
  description_uz TEXT,
  description_en TEXT,
  description_ru TEXT,
  description_ko TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('tuition_payment', 'interview', 'deadline', 'orientation', 'other')),
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  is_all_day BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.university_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_events ENABLE ROW LEVEL SECURITY;

-- Enable realtime for channel_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;

-- RLS Policies for university_rooms
CREATE POLICY "Anyone can view active rooms"
ON public.university_rooms FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage rooms"
ON public.university_rooms FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for room_members
CREATE POLICY "Members can view room members"
ON public.room_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.room_members rm
    WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can manage room members"
ON public.room_members FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'call_operator') OR has_role(auth.uid(), 'document_handler'));

CREATE POLICY "Users can join rooms for their applications"
ON public.room_members FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.university_rooms ur ON ur.university_id = a.university_id
    WHERE a.student_id = auth.uid() AND ur.id = room_id
  )
);

-- RLS Policies for room_channels
CREATE POLICY "Members can view channels"
ON public.room_channels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.room_members rm
    WHERE rm.room_id = room_channels.room_id AND rm.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can manage channels"
ON public.room_channels FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for channel_messages
CREATE POLICY "Members can view messages in their channels"
ON public.channel_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.room_channels rc
    JOIN public.room_members rm ON rm.room_id = rc.room_id
    WHERE rc.id = channel_messages.channel_id AND rm.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send messages to discussion channels"
ON public.channel_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.room_channels rc
    JOIN public.room_members rm ON rm.room_id = rc.room_id
    WHERE rc.id = channel_id AND rm.user_id = auth.uid()
    AND (rc.channel_type = 'discussion' OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'call_operator') OR has_role(auth.uid(), 'document_handler'))
  )
);

CREATE POLICY "Users can update their own messages"
ON public.channel_messages FOR UPDATE
USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
ON public.channel_messages FOR DELETE
USING (sender_id = auth.uid());

CREATE POLICY "Staff can manage all messages"
ON public.channel_messages FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for university_events
CREATE POLICY "Members can view events in their rooms"
ON public.university_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.room_members rm
    WHERE rm.room_id = university_events.room_id AND rm.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can manage events"
ON public.university_events FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'call_operator') OR has_role(auth.uid(), 'document_handler'));

-- Create function to auto-create room and channels when application is created
CREATE OR REPLACE FUNCTION public.handle_new_application_room()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_existing_room_id UUID;
BEGIN
  -- Check if room already exists for this university
  SELECT id INTO v_existing_room_id FROM public.university_rooms WHERE university_id = NEW.university_id;
  
  IF v_existing_room_id IS NULL THEN
    -- Create new room
    INSERT INTO public.university_rooms (university_id) VALUES (NEW.university_id) RETURNING id INTO v_room_id;
    
    -- Create discussion channel
    INSERT INTO public.room_channels (room_id, channel_type, name_uz, name_en, name_ru, name_ko)
    VALUES (v_room_id, 'discussion', 'Muhokama', 'Discussion', 'Обсуждение', '토론');
    
    -- Create announcement channel
    INSERT INTO public.room_channels (room_id, channel_type, name_uz, name_en, name_ru, name_ko)
    VALUES (v_room_id, 'announcement', 'E''lonlar', 'Announcements', 'Объявления', '공지사항');
  ELSE
    v_room_id := v_existing_room_id;
  END IF;
  
  -- Add student as room member
  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (v_room_id, NEW.student_id, 'student')
  ON CONFLICT (room_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER on_application_created_add_to_room
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_application_room();

-- Trigger for updating updated_at
CREATE TRIGGER update_channel_messages_updated_at
BEFORE UPDATE ON public.channel_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_university_events_updated_at
BEFORE UPDATE ON public.university_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();