-- Qirg'iziston lidlari har qanday kanaldan (QA audit 2026-11-11, 1-topilma):
-- hozir faqat ilova lid formasi (app_quiz_submit) leads.country = 'KG' qo'yib,
-- lidni Madinaga biriktiradi. Telegram, Instagram, qo'ng'iroq yoki CRM'da
-- qo'lda kiritilgan +996 raqamli lid O'zbekiston lidi bo'lib qolardi.
--
-- Endi lid yaratilganda yoki raqami / mamlakati o'zgarganda:
--   * country bo'sh va raqam(lar) orasida 996 + 9 raqam bor, O'zbekiston
--     raqami (998 + 9 yoki yalang 9 raqam) yo'q bo'lsa → country = 'KG';
--   * country bor va lid hech kimga biriktirilmagan bo'lsa → shu mamlakat
--     egasi (lead_country_assignees; KG → Madina).
-- Xodim lidni o'zi boshqaga bergan yoki egasini olib tashlagan bo'lsa,
-- trigger tegmaydi (assigned_to o'zgarishi triggerni ishga tushirmaydi).

create or replace function public.fn_leads_country_from_phone()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_parts text[];
begin
  if new.country is null and new.phone is not null then
    v_parts := public.fn_phone_digit_parts(new.phone);
    if exists (select 1 from unnest(v_parts) p where p ~ '^996[0-9]{9}$')
       and not exists (select 1 from unnest(v_parts) p where p ~ '^998[0-9]{9}$' or p ~ '^[0-9]{9}$') then
      new.country := 'KG';
    end if;
  end if;

  if new.country is not null and new.assigned_to is null
     and (tg_op = 'INSERT'
          or old.country is distinct from new.country
          or old.phone is distinct from new.phone) then
    select a.user_id into new.assigned_to
      from public.lead_country_assignees a
     where a.country = new.country;
  end if;
  return new;
end;
$$;

comment on function public.fn_leads_country_from_phone() is
  '+996 raqamli lidga country = KG; egasi bo''sh bo''lsa lead_country_assignees bo''yicha biriktiradi (KG → Madina).';

revoke all on function public.fn_leads_country_from_phone() from public, anon, authenticated;

drop trigger if exists trg_leads_country_from_phone on public.leads;
create trigger trg_leads_country_from_phone
  before insert or update of phone, country on public.leads
  for each row execute function public.fn_leads_country_from_phone();

-- Bor lidlar (2026-11-11 da +996 raqamli lid 0 ta; xavfsizlik uchun).
update public.leads l
   set country = 'KG'
 where l.country is null
   and exists (select 1 from unnest(public.fn_phone_digit_parts(l.phone)) p where p ~ '^996[0-9]{9}$')
   and not exists (select 1 from unnest(public.fn_phone_digit_parts(l.phone)) p where p ~ '^998[0-9]{9}$' or p ~ '^[0-9]{9}$');
