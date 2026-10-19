-- Off-hours automatic reply: say the working hours and that Sunday is off
-- (owner, 2026-10-19). The contact time stays "kun davomida", with no clock
-- time (20261019160000_after_hours_reply_no_time.sql).
--
-- The texts in use move to [1]–[3]; every earlier wording stays after them so
-- replies already sent with it are still recognised as automatic.
--
-- Applied to production on 2026-10-19 through the Supabase connector.

create or replace function public.fn_after_hours_reply_texts()
returns text[]
language sql
immutable
as $$
  select array[
    -- In use: [1] before 09:00, [2] a weekday evening, [3] Saturday evening and Sunday.
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozir ish vaqtimiz hali boshlanmagan (ish vaqtimiz: 09:00–18:00). Operatorlarimiz bugun kun davomida siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 09:00–18:00). Operatorlarimiz ertaga kun davomida siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 09:00 dan 18:00 gacha, yakshanba dam olish kuni. Operatorlarimiz dushanba kuni kun davomida siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    -- 2026-10-19, no working hours — still recognised.
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozir ish vaqtimiz hali boshlanmagan. Operatorlarimiz bugun kun davomida siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan. Operatorlarimiz ertaga kun davomida siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha. Operatorlarimiz dushanba kuni kun davomida siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    -- 09:00 wording — still recognised.
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 09:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 09:00–18:00). Operatorlarimiz ertaga soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 09:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    -- 10:00 wording — still recognised.
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 10:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 10:00–18:00). Operatorlarimiz ertaga soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 10:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!'
  ]::text[]
$$;

-- Replies queued but not sent yet go out with the new wording.
update public.after_hours_reply_queue q
   set reply_text = (public.fn_after_hours_reply_texts())[((i - 1) % 3) + 1]
  from generate_subscripts(public.fn_after_hours_reply_texts(), 1) as i
 where q.claimed_at is null
   and i > 3
   and q.reply_text = (public.fn_after_hours_reply_texts())[i];
