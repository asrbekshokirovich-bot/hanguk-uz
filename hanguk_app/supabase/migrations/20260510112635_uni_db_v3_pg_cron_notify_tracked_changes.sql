-- ============================================================================
--  Schedule notify-tracked-changes to drain change_event_outbox every minute
--
--  Requires:
--    1. pg_cron extension (enabled below)
--    2. pg_net extension for outbound HTTP calls
--    3. Vault secret 'uni_db_service_role_jwt' containing the project's
--       service-role JWT. The cron silently fails until the user runs:
--         select vault.update_secret(
--           (select id from vault.secrets where name='uni_db_service_role_jwt'),
--           '<service-role-jwt>'
--         );
--       (find the JWT in Supabase Dashboard → Project Settings → API →
--        service_role key)
--
--  Applied via Supabase MCP on 2026-05-10 to both staging
--  (nhjzbjzhmugcmzchzxlv) and production (lysjdtyanhdfphqyijsr). The
--  v_url variable inside fn_invoke_notify_tracked_changes() differs
--  per project — staging points at nhjzbjzhmugcmzchzxlv.supabase.co,
--  prod at lysjdtyanhdfphqyijsr.supabase.co. This file shows the
--  staging version; the prod migration is identical except for that
--  one URL constant.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.fn_invoke_notify_tracked_changes()
returns bigint
language plpgsql
security definer
set search_path = public, vault, pg_catalog
as $$
declare
  v_jwt    text;
  v_url    text := 'https://nhjzbjzhmugcmzchzxlv.supabase.co/functions/v1/notify-tracked-changes';
  v_request_id bigint;
begin
  select decrypted_secret into v_jwt
    from vault.decrypted_secrets
   where name = 'uni_db_service_role_jwt'
   limit 1;

  if v_jwt is null or v_jwt = '' or v_jwt = 'REPLACE_ME' then
    raise notice 'uni_db_service_role_jwt vault secret is unset; skipping invoke';
    return 0;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_jwt
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.fn_invoke_notify_tracked_changes() from public, anon, authenticated;
grant execute on function public.fn_invoke_notify_tracked_changes() to service_role;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'uni_db_service_role_jwt') then
    perform vault.create_secret('REPLACE_ME', 'uni_db_service_role_jwt',
      'Service-role JWT used by pg_cron to invoke notify-tracked-changes. '
      'Update via: select vault.update_secret(id, ''<jwt>'') from vault.secrets where name=''uni_db_service_role_jwt'';');
  end if;
end
$$;

select cron.schedule(
  'uni-db-notify-tracked-changes',
  '* * * * *',
  $job$ select public.fn_invoke_notify_tracked_changes(); $job$
);
