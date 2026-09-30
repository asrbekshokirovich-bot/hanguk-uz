-- Catalogue document names in the app's language.
--
-- The owner's rule (2026-09-30): once a language is chosen in the app,
-- everything it shows is in that language, except faculty, university and city
-- names. The admission documents of each university come from the guideline
-- Excel, which is filled in Uzbek (university_guideline_docs.hujjat_nomi), so
-- until now "Ariza formasi", "Bank spravkasi" … showed in every language.
--
--   * app_text_translations holds the English, Korean and Russian of each
--     Uzbek name. The names in the catalogue today are filled in below
--     (translated by hand); a name added later is translated by the
--     translate-app-texts edge function, which pg_cron runs every 30 minutes.
--   * v_app_university_docs gains hujjat_nomi_en / _ko / _ru; the app picks
--     the one for its language and falls back to the Uzbek name.

create table if not exists public.app_text_translations (
  source        text primary key,
  en            text,
  ko            text,
  ru            text,
  translated_by text not null default 'manual',
  translated_at timestamptz not null default now()
);

alter table public.app_text_translations enable row level security;
revoke all on table public.app_text_translations from anon, authenticated;

-- As in 20260925180000_app_university_catalog_views.sql, plus the translations.
create or replace view public.v_app_university_docs as
select
  d.guideline_uuid as guideline_id,
  d.tartib,
  d.hujjat_nomi,
  d.kimlar_uchun,
  d.majburiy,
  d.apostil,
  t.en as hujjat_nomi_en,
  t.ko as hujjat_nomi_ko,
  t.ru as hujjat_nomi_ru
from public.university_guideline_docs d
left join public.app_text_translations t on t.source = d.hujjat_nomi;

revoke all on public.v_app_university_docs from public, anon, authenticated;
grant select on public.v_app_university_docs to anon, authenticated;

-- The document names nobody has translated yet, for translate-app-texts.
create or replace function public.fn_app_texts_untranslated(p_limit integer default 40)
returns table(source text)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select distinct d.hujjat_nomi
    from public.university_guideline_docs d
    left join public.app_text_translations t on t.source = d.hujjat_nomi
   where coalesce(trim(d.hujjat_nomi), '') <> ''
     and t.source is null
   order by 1
   limit greatest(coalesce(p_limit, 40), 1)
$$;

revoke all on function public.fn_app_texts_untranslated(integer) from public, anon, authenticated;
grant execute on function public.fn_app_texts_untranslated(integer) to service_role;

-- Every 30 minutes, with the project's secret key (same wiring as
-- infra-health-check-hourly).
select cron.schedule(
  'translate-app-texts-30min',
  '17,47 * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/translate-app-texts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)
  $cron$
);

-- The names in the catalogue on 2026-09-30, translated by hand.
