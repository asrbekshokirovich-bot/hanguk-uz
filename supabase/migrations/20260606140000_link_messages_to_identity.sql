-- Non-invasive message linking.
-- Whenever ANY message is inserted (by any bot/webhook), auto-fill student_id
-- from the identity spine so conversations track by student without each
-- ingestion path having to do the lookup itself.
CREATE OR REPLACE FUNCTION public.link_message_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.student_id IS NULL AND NEW.sender_id IS NOT NULL THEN
    SELECT student_id, lead_id INTO r
    FROM public.communication_identities
    WHERE channel = NEW.source AND identifier = NEW.sender_id
    LIMIT 1;

    IF r.student_id IS NOT NULL THEN
      NEW.student_id := r.student_id;
    END IF;
    IF r.lead_id IS NOT NULL AND (NEW.metadata ->> 'lead_id') IS NULL THEN
      NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('lead_id', r.lead_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_message_identity ON public.messages;
CREATE TRIGGER trg_link_message_identity
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.link_message_identity();
