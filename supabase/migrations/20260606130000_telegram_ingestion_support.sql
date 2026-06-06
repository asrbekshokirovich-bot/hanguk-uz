-- ============================================================================
-- Telegram ingestion support
-- ----------------------------------------------------------------------------
-- upsert_message_thread(): atomic thread upsert that works for BOTH directions.
-- The existing increment_thread_unread() only models inbound bot messages; the
-- personal-account userbot mirrors outbound messages too, must set/preserve the
-- student link, and must reset unread when staff reply. One round-trip, no race.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_message_thread(
  p_source          text,
  p_sender_id       text,
  p_sender_name     text,
  p_sender_avatar   text,
  p_student_id      uuid,
  p_last_message_at timestamptz,
  p_direction       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.message_threads (
    source, sender_id, sender_name, sender_avatar, student_id,
    last_message_at, unread_count, status
  )
  VALUES (
    p_source, p_sender_id, p_sender_name, p_sender_avatar, p_student_id,
    COALESCE(p_last_message_at, now()),
    CASE WHEN p_direction = 'incoming' THEN 1 ELSE 0 END,
    'active'
  )
  ON CONFLICT (source, sender_id) DO UPDATE SET
    last_message_at = GREATEST(message_threads.last_message_at, EXCLUDED.last_message_at),
    sender_name     = COALESCE(EXCLUDED.sender_name, message_threads.sender_name),
    sender_avatar   = COALESCE(EXCLUDED.sender_avatar, message_threads.sender_avatar),
    -- Never clobber an existing (manual or auto) student link with NULL.
    student_id      = COALESCE(message_threads.student_id, EXCLUDED.student_id),
    unread_count    = CASE
                        WHEN p_direction = 'incoming' THEN message_threads.unread_count + 1
                        ELSE 0
                      END;
END;
$$;
