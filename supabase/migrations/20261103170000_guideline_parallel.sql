-- PDF navbatini tezlashtirish va 50 MB+ PDF'lar (2026-11-03, Asrbek: "o'qilmagan
-- o'qib joyla, hajmi kattalarga o'zing o'qi, 15 minutda tugat").
--
--   guideline-index-10min  har daqiqada 3 ta parallel chaqiruv (slot 0, 1, 2):
--                          k-chaqiruv navbatdagi k-hujjatni oladi, shuning uchun
--                          bitta PDF ikki marta o'qilmaydi; ~3 PDF/daqiqa.
--   ai_guideline_index_next  oxirgi 3 daqiqada boshlangan ("started") hujjatni
--                          bermaydi — keyingi daqiqadagi chaqiruv uni qayta olmasin.
--   guideline-claude-3min  har 3 daqiqada 3 ta parallel Claude chaqiruvi (3 PDF).
--   ai_guideline_claude_next(p_limit)  bir nechta hujjat qaytaradi.
--   50 MB+ PDF'lar (Daejon Health 54 MB, KIER 63 MB) URL orqali rad etilgan edi;
--   endi Files API orqali o'qiladi — "claude failed (3) … exceeds the maximum
--   allowed size" holati qayta navbatga qo'yiladi.

create or replace function public.ai_guideline_index_next(p_limit integer default 3)
returns table (
  id uuid, institution_id uuid, storage_path text, mime_type text, file_hash text,
  academic_year smallint, semester text, source_url_ko text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.institution_id, d.storage_path, d.mime_type, d.file_hash_sha256,
         d.academic_year, d.semester, d.source_url_ko
    from guideline_documents d
    left join guideline_index_state s on s.guideline_document_id = d.id
   where d.superseded_by_id is null
     and d.storage_path is not null
     and (d.storage_path ilike '%.pdf'
          or d.mime_type in ('application/pdf', 'application/download', 'application/octet-stream'))
     and (s.guideline_document_id is null
          or (s.status = 'failed' and s.attempts < 3)
          or s.file_hash is distinct from d.file_hash_sha256)
     and not (coalesce(s.error, '') like 'started;%' and s.indexed_at > now() - interval '3 minutes')
   order by (d.academic_year = (select qabul_yili from ai_uni_season())) desc nulls last,
            d.academic_year desc nulls last,
            d.fetched_at desc nulls last
   limit greatest(1, least(coalesce(p_limit, 3), 20));
$$;

drop function if exists public.ai_guideline_claude_next();
create or replace function public.ai_guideline_claude_next(p_limit integer default 1)
returns table (
  id uuid, institution_id uuid, storage_path text, file_hash text,
  academic_year smallint, semester text, status text, error text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.institution_id, d.storage_path, d.file_hash_sha256,
         d.academic_year, d.semester, s.status, s.error
    from guideline_index_state s
    join guideline_documents d on d.id = s.guideline_document_id
   where d.superseded_by_id is null
     and d.storage_path is not null
     and s.file_hash is not distinct from d.file_hash_sha256
     and (s.status = 'no_text'
          or (s.status = 'failed' and s.attempts >= 3)
          or (s.status = 'skipped' and coalesce(s.error, '') not like 'not a PDF%'))
     and coalesce(s.error, '') not like 'claude failed (3)%'
   order by (coalesce(s.error, '') like 'claude: %') desc,          -- finish the ones in progress
            (d.academic_year = (select qabul_yili from ai_uni_season())) desc nulls last,
            d.academic_year desc nulls last,
            d.id
   limit greatest(1, least(coalesce(p_limit, 1), 3));
$$;

revoke all on function public.ai_guideline_claude_next(integer) from public, anon, authenticated;
grant execute on function public.ai_guideline_claude_next(integer) to service_role;

update public.guideline_index_state
   set error = 'claude: reset for the Files API (2026-11-03)'
 where error like 'claude failed (3)%exceeds the maximum allowed size%';

do $$
begin
  perform cron.unschedule('guideline-index-10min')
    where exists (select 1 from cron.job where jobname = 'guideline-index-10min');
  perform cron.unschedule('guideline-claude-3min')
    where exists (select 1 from cron.job where jobname = 'guideline-claude-3min');
end $$;

select cron.schedule(
  'guideline-index-10min',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/guideline-index',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := jsonb_build_object('slot', g),
      timeout_milliseconds := 150000)
      from generate_series(0, 2) g
     where exists (select 1 from public.ai_guideline_index_next(1))
        or (g = 0 and exists (select 1 from public.embedding_chunks
                               where embedding is null and guideline_document_id is not null));
  $cron$
);

select cron.schedule(
  'guideline-claude-3min',
  '*/3 * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/guideline-index',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := jsonb_build_object('mode', 'claude', 'slot', g),
      timeout_milliseconds := 150000)
      from generate_series(0, 2) g
     where exists (select 1 from public.ai_guideline_claude_next(3) offset g);
  $cron$
);
