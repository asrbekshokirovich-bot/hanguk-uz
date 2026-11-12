-- content_embed jobs are made for every message, document extraction and call
-- analysis, and nothing has ever processed one:
--
--   * the worker (embed-content) was retired on 2026-11-05 and
--     dispatch-comm-jobs skips the job type (RETIRED_JOB_TYPES);
--   * communication_embeddings holds 0 rows;
--   * the queue held 18 063 such jobs on 2026-11-12, all `pending` with 0
--     attempts, about 510 more every day — which reads as a stuck pipeline to
--     whoever looks at comm_processing_jobs (it did, in this cycle's first
--     round) and is one more insert on every incoming message.
--
-- The triggers are switched off, not removed: if embeddings come back, a
-- migration enables them again (and backfills — the old jobs point at rows
-- whose text may have changed since).
--
-- The jobs already in the queue stay as they are: the status check allows
-- only pending/processing/done/error, `error` would raise the hourly
-- infra-health-check alarm ("call_jobs"), and they are not `done`.
do $$
declare
  v_fn regprocedure := to_regprocedure('public.enqueue_content_embed()');
  r record;
begin
  if v_fn is null then
    return;
  end if;
  -- messages is written every minute: give up rather than queue behind a
  -- long transaction and hold every insert up meanwhile.
  perform set_config('lock_timeout', '5s', true);
  for r in
    select c.relname, t.tgname
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and not t.tgisinternal
       and t.tgfoid = v_fn
  loop
    execute format('alter table public.%I disable trigger %I', r.relname, r.tgname);
  end loop;
end $$;
