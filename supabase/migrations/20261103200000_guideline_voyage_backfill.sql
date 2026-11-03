-- PDF bo'laklari uchun Voyage embedding (2026-11-03, Asrbek: "Gemini o'rniga
-- hozircha Claude bilan" — Anthropic'ning o'z embedding modeli yo'q, Voyage'ni
-- tavsiya qiladi). VOYAGE_API_KEY qo'yilgach guideline-index vektorsiz VA Gemini
-- vektorli bo'laklarni voyage-4 @1024 bilan qayta hisoblaydi (bitta vektor
-- maydoni). Cron slot 0 shu bo'laklar qolguncha ham chaqiriladi.
do $$
begin
  perform cron.unschedule('guideline-index-10min')
    where exists (select 1 from cron.job where jobname = 'guideline-index-10min');
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
                               where guideline_document_id is not null
                                 and (embedding is null or chunk_meta->>'model' = 'gemini-embedding-001')));
  $cron$
);
