-- PDF bo'lmagan yo'riqnomalar (HWP, DOC, rasm) — 12 ta (2026-11-04, Asrbek:
-- "HWP'ni PDF qilib o'zgartir, qil"). GitHub jarayoni (guideline-convert-nonpdf)
-- faylni PDF'ga o'girib guideline-blobs/converted/<id>.pdf ga yuklaydi va shu
-- jadvalga yozadi. guideline_documents o'zgarmaydi (uni_db uning egasi); indeks
-- navbatlari o'girilgan PDF bo'lsa o'shani oladi.

create table if not exists public.guideline_converted (
  document_id uuid primary key references public.guideline_documents(id) on delete cascade,
  pdf_path text not null,
  pdf_sha256 text not null,
  source_format text not null,
  converter text not null,
  converted_at timestamptz not null default now()
);
alter table public.guideline_converted enable row level security;
drop policy if exists guideline_converted_staff_read on public.guideline_converted;
create policy guideline_converted_staff_read on public.guideline_converted
  for select to authenticated using (public.is_non_investor_staff());

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
  select d.id, d.institution_id,
         coalesce(c.pdf_path, d.storage_path),
         case when c.document_id is not null then 'application/pdf' else d.mime_type end,
         coalesce(c.pdf_sha256, d.file_hash_sha256),
         d.academic_year, d.semester, d.source_url_ko
    from guideline_documents d
    left join guideline_converted c on c.document_id = d.id
    left join guideline_index_state s on s.guideline_document_id = d.id
   where d.superseded_by_id is null
     and d.storage_path is not null
     and (c.document_id is not null
          or d.storage_path ilike '%.pdf'
          or d.mime_type in ('application/pdf', 'application/download', 'application/octet-stream'))
     and (s.guideline_document_id is null
          or (s.status = 'failed' and s.attempts < 3)
          or s.file_hash is distinct from coalesce(c.pdf_sha256, d.file_hash_sha256))
     and not (coalesce(s.error, '') like 'started;%' and s.indexed_at > now() - interval '3 minutes')
   order by (d.academic_year = (select qabul_yili from ai_uni_season())) desc nulls last,
            d.academic_year desc nulls last,
            d.fetched_at desc nulls last
   limit greatest(1, least(coalesce(p_limit, 3), 20));
$$;

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
  select d.id, d.institution_id, coalesce(c.pdf_path, d.storage_path), coalesce(c.pdf_sha256, d.file_hash_sha256),
         d.academic_year, d.semester, s.status, s.error
    from guideline_index_state s
    join guideline_documents d on d.id = s.guideline_document_id
    left join guideline_converted c on c.document_id = d.id
   where d.superseded_by_id is null
     and d.storage_path is not null
     and s.file_hash is not distinct from coalesce(c.pdf_sha256, d.file_hash_sha256)
     and (s.status = 'no_text'
          or (s.status = 'failed' and s.attempts >= 3)
          or (s.status = 'skipped' and coalesce(s.error, '') not like 'not a PDF%'))
     and coalesce(s.error, '') not like 'claude failed (3)%'
   order by (coalesce(s.error, '') like 'claude: %') desc,
            (d.academic_year = (select qabul_yili from ai_uni_season())) desc nulls last,
            d.academic_year desc nulls last,
            d.id
   limit greatest(1, least(coalesce(p_limit, 1), 3));
$$;

revoke all on function public.ai_guideline_claude_next(integer) from public, anon, authenticated;
grant execute on function public.ai_guideline_claude_next(integer) to service_role;
