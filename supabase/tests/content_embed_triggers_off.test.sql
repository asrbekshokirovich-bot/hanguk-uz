-- Local test for 20261112150000_content_embed_triggers_off.sql.
--
--   createdb embed_off_test && psql -v ON_ERROR_STOP=1 -d embed_off_test \
--     -f supabase/tests/content_embed_triggers_off.test.sql
\set ON_ERROR_STOP on

-- The queue and the three sources, as far as the trigger reads them.
create table public.comm_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  ref_table text not null,
  ref_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  created_at timestamptz not null default now(),
  unique (job_type, ref_table, ref_id));
create table public.messages (id uuid primary key default gen_random_uuid(), content text);
create table public.document_extractions (id uuid primary key default gen_random_uuid(), full_text text);
create table public.call_analyses (id uuid primary key default gen_random_uuid(), summary_uz text, summary_en text);

create function public.enqueue_content_embed() returns trigger language plpgsql as $$
begin
  insert into public.comm_processing_jobs (job_type, ref_table, ref_id)
  values ('content_embed', tg_table_name, new.id)
  on conflict (job_type, ref_table, ref_id) do update set status = 'pending';
  return new;
end $$;
create trigger trg_enqueue_content_embed_messages after insert or update on public.messages
  for each row execute function public.enqueue_content_embed();
create trigger trg_enqueue_content_embed_documents after insert or update on public.document_extractions
  for each row execute function public.enqueue_content_embed();
create trigger trg_enqueue_content_embed_calls after insert or update on public.call_analyses
  for each row execute function public.enqueue_content_embed();

-- Another job type on the same table: it must keep working.
create function public.enqueue_other() returns trigger language plpgsql as $$
begin
  insert into public.comm_processing_jobs (job_type, ref_table, ref_id) values ('student_track_infer', 'messages', new.id);
  return new;
end $$;
create trigger trg_other after insert on public.messages for each row execute function public.enqueue_other();

-- Before: every row makes a job nobody will take.
insert into public.messages (content) values ('salom');
insert into public.document_extractions (full_text) values ('matn');
insert into public.call_analyses (summary_uz) values ('xulosa');
do $$ begin
  assert (select count(*) from public.comm_processing_jobs where job_type = 'content_embed') = 3, 'fixture: three jobs before';
end $$;

\i supabase/migrations/20261112150000_content_embed_triggers_off.sql

insert into public.messages (content) values ('yana bir xabar');
update public.messages set content = 'tahrirlangan' where content = 'salom';
insert into public.document_extractions (full_text) values ('yana matn');
insert into public.call_analyses (summary_uz) values ('yana xulosa');

do $$
declare n int;
begin
  select count(*) into n from public.comm_processing_jobs where job_type = 'content_embed';
  assert n = 3, format('no new content_embed job after the migration, got %s', n);
  -- What was queued stays queued (see the migration for why).
  assert (select count(*) from public.comm_processing_jobs where job_type = 'content_embed' and status = 'pending') = 3, 'old jobs untouched';
  -- Other triggers on the same tables are not touched.
  assert (select count(*) from public.comm_processing_jobs where job_type = 'student_track_infer') = 2, 'other job types still enqueue';
  assert (select count(*) from pg_trigger where tgfoid = 'public.enqueue_content_embed()'::regprocedure and tgenabled = 'D') = 3, 'three triggers disabled';
  assert (select tgenabled from pg_trigger where tgname = 'trg_other') = 'O', 'the other trigger stays enabled';
end $$;

-- Running it again changes nothing; on a database without the function it is a no-op.
\i supabase/migrations/20261112150000_content_embed_triggers_off.sql
drop trigger trg_enqueue_content_embed_messages on public.messages;
drop trigger trg_enqueue_content_embed_documents on public.document_extractions;
drop trigger trg_enqueue_content_embed_calls on public.call_analyses;
drop function public.enqueue_content_embed();
\i supabase/migrations/20261112150000_content_embed_triggers_off.sql

\echo content_embed_triggers_off: OK
