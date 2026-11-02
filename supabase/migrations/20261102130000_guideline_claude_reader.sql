-- Hanguk AI 2.0 — PDF'larni Claude o'qiydi (2026-11-02, Asrbek: "hozir qil").
--
--   ai_guideline_claude_next()  pdf.js o'qiy olmagan PDF'lar: skan (no_text),
--                               CPU limitiga sig'magan (failed, 3 urinish),
--                               40 MB dan katta (skipped). Claude 3 marta
--                               ketma-ket yiqilsa navbatdan chiqadi.
--   cron guideline-claude-3min  har 3 daqiqada bitta Claude chaqiruvi (4 bet);
--                               PDF prompt keshda (5 daqiqa) qoladi.
--   cron guideline-index-10min  endi vektorsiz bo'laklar qolganda ham ishlaydi
--                               (oldin faqat navbat bo'lsa chaqirilardi).

create or replace function public.ai_guideline_claude_next()
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
   order by (coalesce(s.error, '') like 'claude: %') desc,          -- finish the one in progress
            (d.academic_year = (select qabul_yili from ai_uni_season())) desc nulls last,
            d.academic_year desc nulls last
   limit 1;
$$;

revoke all on function public.ai_guideline_claude_next() from public, anon, authenticated;
grant execute on function public.ai_guideline_claude_next() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'guideline-claude-3min') then
    perform cron.unschedule('guideline-claude-3min');
  end if;
  if exists (select 1 from cron.job where jobname = 'guideline-index-10min') then
    perform cron.unschedule('guideline-index-10min');
  end if;
end $$;

select cron.schedule(
  'guideline-index-10min',
  '*/10 * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/guideline-index',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000)
    where exists (select 1 from public.ai_guideline_index_next(1))
       or exists (select 1 from public.embedding_chunks
                   where embedding is null and guideline_document_id is not null);
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
      body := '{"mode":"claude"}'::jsonb,
      timeout_milliseconds := 150000)
    where exists (select 1 from public.ai_guideline_claude_next());
  $cron$
);
