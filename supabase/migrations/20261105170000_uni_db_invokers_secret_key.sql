-- Security audit 2026-11-05: move the last pg_net callers off the legacy
-- service_role JWT (vault `uni_db_service_role_jwt`) so legacy API keys can be
-- deactivated. The legacy key is exposed in git history, so this is a blocker.
--
-- 1) notify-tracked-changes (pg_cron job `uni-db-notify-tracked-changes`,
--    every 5 min): send the sb_secret_ key from vault `secret_key` on the
--    `apikey` header. The function now runs with verify_jwt = false and checks
--    the key itself (hanguk_app/supabase/functions/notify-tracked-changes).
-- 2) fn_invoke_crawl_dispatcher(): no cron job or code calls it any more
--    (ai_crawl_config.enabled = false since 2026-07; the crawl moved to the
--    uni_db GitHub workflows — see hanguk_app/docs/uni_db/phase4-teardown.sql).
--    Dropped instead of migrated.

create or replace function public.fn_invoke_notify_tracked_changes()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'vault', 'pg_catalog'
as $function$
declare
  v_key        text;
  v_url        text := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/notify-tracked-changes';
  v_request_id bigint;
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'secret_key'
   limit 1;

  if v_key is null or v_key = '' then
    raise notice 'vault secret_key is unset; skipping invoke';
    return 0;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey',       v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

revoke execute on function public.fn_invoke_notify_tracked_changes() from public, anon, authenticated;
grant execute on function public.fn_invoke_notify_tracked_changes() to service_role;

drop function if exists public.fn_invoke_crawl_dispatcher();
