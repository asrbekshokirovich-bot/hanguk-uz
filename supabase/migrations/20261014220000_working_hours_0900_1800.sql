-- Working hours are 09:00–18:00, Monday–Saturday, Tashkent time (owner,
-- 2026-10-14). Sunday stays off.
--
-- The working day now starts at 09:00 instead of 09:40 (replies said 10:00):
--   * the automatic reply to a chat that writes off hours names 09:00
--     ("bugun soat 09:00 da" before 09:00, "ertaga" on a weekday evening,
--     "dushanba kuni" from Saturday 18:00 and all of Sunday);
--   * an off-hours lead's 10-minute countdown starts at 09:00 of the next
--     working morning (fn_lead_sla_start);
--   * the "no contact for 10 minutes" alert runs 09:00–18:00. With the
--     countdown and the working day both starting at 09:00, the 09:40–10:00
--     special case of 20261005100000_lead_alerts_working_hours.sql is gone.
-- The replies sent before this change (items 4–6) stay in the list so that
-- their echo is still recognised as automatic (fn_is_automatic_outgoing).
--
-- Applied to production on 2026-10-14 through the Supabase connector
-- (version 20261014172806); kept here so the repo matches.

create or replace function public.fn_after_hours_reply_texts()
returns text[]
language sql
immutable
as $$
  select array[
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 09:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 09:00–18:00). Operatorlarimiz ertaga soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 09:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 10:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 10:00–18:00). Operatorlarimiz ertaga soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 10:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!'
  ]::text[]
$$;

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

create or replace function public.fn_lead_sla_start(p_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Tashkent';
  v_dow   integer   := extract(isodow from v_local)::integer; -- 1 = Monday … 7 = Sunday
  v_time  time      := v_local::time;
  v_day   date;
begin
  if v_dow <= 6 and v_time >= time '09:00' and v_time < time '18:00' then
    return p_at;
  end if;

  if v_dow <= 6 and v_time < time '09:00' then
    v_day := v_local::date;
  else
    v_day := v_local::date + 1;
  end if;
  if extract(isodow from v_day) = 7 then
    v_day := v_day + 1;
  end if;

  return (v_day + time '09:00') at time zone 'Asia/Tashkent';
end;
$$;

-- p_start is no longer needed (every countdown starts inside 09:00–18:00) but
-- stays in the signature for fn_lead_sla_scan.
create or replace function public.fn_lead_alerts_open(p_now timestamptz, p_start timestamptz)
returns boolean
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_local timestamp := p_now at time zone 'Asia/Tashkent';
  v_dow   integer   := extract(isodow from v_local)::integer; -- 1 = Monday … 7 = Sunday
  v_time  time      := v_local::time;
begin
  return not (v_dow = 7 or v_time < time '09:00' or v_time >= time '18:00');
end;
$$;
