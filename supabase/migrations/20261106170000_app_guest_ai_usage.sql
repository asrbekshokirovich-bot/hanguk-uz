-- Ushlab qolish D4 (Tayyorgarlik, mehmon): what a guest has used today and
-- this week, so the app shows «Bugun 10 ta savoldan 7 tasi qoldi» and
-- «Haftasiga 1 ta · bu hafta bo'sh» from the server's own counters.
--
-- * Hanguk AI: ai_quota key guest:i:<install_id>:<YYYY-MM-DD, Tashkent>
--   (hanguk-ai-chat quotaFor; limit AI_LIMIT_GUEST_DAY, 10).
-- * Interview: ai_quota key interview:<auth.uid()>:<ISO week, Tashkent>
--   (interview-ai guestInterviewKey; limit AI_LIMIT_GUEST_INTERVIEW_WEEK, 1).
-- The limits below are the functions' defaults (QU4); change both together.

create or replace function public.app_guest_ai_usage(p_install_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select jsonb_build_object(
    'ai_used', coalesce((
      select q.count from public.ai_quota q
       where q.key = 'guest:i:' || lower(p_install_id::text) || ':'
                     || to_char(now() at time zone 'Asia/Tashkent', 'YYYY-MM-DD')), 0),
    'ai_limit', 10,
    'interview_used', coalesce((
      select q.count from public.ai_quota q
       where auth.uid() is not null
         and q.key = 'interview:' || auth.uid()::text || ':'
                     || to_char(now() at time zone 'Asia/Tashkent', 'IYYY-"W"IW')), 0),
    'interview_limit', 1);
$$;

revoke all on function public.app_guest_ai_usage(uuid) from public;
grant execute on function public.app_guest_ai_usage(uuid) to anon, authenticated;
