-- Instagram comments in the owner's morning report.
--
-- instagram-webhook has stored every comment under Hanguk's posts, reels and
-- ads since July 2026 (instagram_comments), and instagram-send can reply to
-- one, but no page of the CRM shows them: 470 comments from other people, all
-- still `new`. In the 30 days to 12 November there were 56 — questions under
-- paid ads ("Narxi qancha", "Yosh chegarasi nechchi", a row of "+"), spam and
-- complaints among them — and not one reply from the account.
--
-- Until there is a place to answer them, the 09:30 report to the owner
-- (lead-sla-check → watchdog.ts) says how many came yesterday and shows the
-- ones still waiting.
--
-- A comment is answered when its status moved off `new` (replied, private
-- reply, hidden — instagram-send), or the account wrote under it afterwards
-- in the Instagram app (the webhook stores those as is_from_me). Comments of
-- emoji or dots alone do not wait for anything.

create or replace function public.fn_instagram_comments_daily(p_day date)
returns table (total integer, unanswered integer, items jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select ic.comment_id, ic.parent_comment_id, ic.from_username, ic.text,
           ic.media_product_type, ic.commented_at, ic.status
      from public.instagram_comments ic
     where not ic.is_from_me
       and ic.commented_at >= (p_day + time '00:00') at time zone 'Asia/Tashkent'
       and ic.commented_at <  (p_day + 1 + time '00:00') at time zone 'Asia/Tashkent'
  ), m as (
    select c.*,
           c.status = 'new'
             and coalesce(c.text, '') ~ '[[:alnum:]+?]'
             and not exists (
               select 1
                 from public.instagram_comments r
                where r.is_from_me
                  and r.commented_at > c.commented_at
                  and r.parent_comment_id = coalesce(c.parent_comment_id, c.comment_id)
             ) as waiting
      from c
  )
  select count(*)::integer,
         count(*) filter (where m.waiting)::integer,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'username', w.from_username,
                    'text', left(regexp_replace(w.text, '\s+', ' ', 'g'), 160),
                    'media', w.media_product_type)
                    order by w.commented_at desc)
             from (select * from m where m.waiting order by m.commented_at desc limit 5) w
         ), '[]'::jsonb)
    from m;
$$;

comment on function public.fn_instagram_comments_daily(date) is
  'Instagram comments from other people on one Tashkent day: how many, how many still wait for an answer, and the latest five of those. For the owner''s 09:30 report (lead-sla-check).';

revoke all on function public.fn_instagram_comments_daily(date) from public, anon, authenticated;
grant execute on function public.fn_instagram_comments_daily(date) to service_role;
