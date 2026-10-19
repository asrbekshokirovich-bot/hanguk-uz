-- Off-hours automatic reply: no clock time (owner, 2026-10-19).
--
-- The replies said "bugun / ertaga / dushanba kuni soat 09:00 da" (10:00
-- before working hours moved). Operators do not call at exactly that time, so
-- the reply now says only the day — "bugun / ertaga / dushanba kuni kun
-- davomida" — and no working hours either.
--
-- fn_after_hours_reply_texts() keeps the earlier texts after the three in use:
-- fn_is_automatic_outgoing() matches outgoing messages against the whole list,
-- so replies already sent with the old wording are still recognised as
-- automatic and do not count as an operator's answer.
--
-- Also recorded here: working hours start at 09:00 (production had been
-- changed from 09:40 / 10:00 by hand; fn_after_hours_reply_text below is the
-- live definition, unchanged).
--
-- Applied to production on 2026-10-19 through the Supabase connector.

create or replace function public.fn_after_hours_reply_texts()
returns text[]
language sql
immutable
as $$
  select array[
    -- In use: [1] before 09:00, [2] a weekday evening, [3] Saturday evening and Sunday.
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozir ish vaqtimiz hali boshlanmagan. Operatorlarimiz bugun kun davomida siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan. Operatorlarimiz ertaga kun davomida siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha. Operatorlarimiz dushanba kuni kun davomida siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    -- Earlier wording (09:00), still recognised.
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 09:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 09:00–18:00). Operatorlarimiz ertaga soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 09:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    -- Earliest wording (10:00), still recognised.
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 10:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 10:00–18:00). Operatorlarimiz ertaga soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 10:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!'
  ]::text[]
$$;

-- Live definition (working hours from 09:00), recorded unchanged.
create or replace function public.fn_after_hours_reply_text(p_at timestamptz)
returns text
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Tashkent';
  v_dow   integer   := extract(isodow from v_local)::integer; -- 1 = Monday … 7 = Sunday
  v_time  time      := v_local::time;
  v_texts text[]    := public.fn_after_hours_reply_texts();
begin
  if v_dow = 7 or (v_dow = 6 and v_time >= time '18:00') then
    return v_texts[3];
  end if;
  if v_time < time '09:00' then
    return v_texts[1];
  end if;
  if v_time >= time '18:00' then
    return v_texts[2];
  end if;
  return null;
end;
$$;

-- Replies queued but not sent yet go out with the new wording. The queue
-- stores the text, so map each old text to the new one at the same position.
update public.after_hours_reply_queue q
   set reply_text = (public.fn_after_hours_reply_texts())[((i - 1) % 3) + 1]
  from generate_subscripts(public.fn_after_hours_reply_texts(), 1) as i
 where q.claimed_at is null
   and i > 3
   and q.reply_text = (public.fn_after_hours_reply_texts())[i];
