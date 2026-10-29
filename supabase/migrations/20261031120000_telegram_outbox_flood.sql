-- telegram_outbox: a send Telegram refused for flood reasons is not retried.
--
-- 2026-10-28/29: four replies to one lead came back PEER_FLOOD and each was
-- tried five times within ~20 seconds (complete_telegram_outbox requeues any
-- failure until attempts >= 5). Retrying a flood limit only feeds it and keeps
-- the account restricted longer. The worker now reports such a failure as
-- final, and this function honours that.

drop function if exists public.complete_telegram_outbox(uuid, boolean, bigint, text);

create function public.complete_telegram_outbox(
  p_id uuid,
  p_ok boolean,
  p_tg_message_id bigint default null,
  p_error text default null,
  p_final boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.telegram_outbox;
  v_external_id text;
begin
  update public.telegram_outbox
     set status        = case
                           when p_ok then 'sent'
                           when p_final or attempts >= 5 then 'failed'
                           else 'pending'
                         end,
         tg_message_id = coalesce(p_tg_message_id, tg_message_id),
         last_error    = case when p_ok then null else p_error end,
         sent_at       = case when p_ok then now() else sent_at end
   where id = p_id
  returning * into v_row;

  if v_row.id is null or v_row.message_id is null then
    return;
  end if;

  if not p_ok then
    -- Still retrying: show why on the bubble. Out of attempts (or final) is the
    -- propagate trigger's business.
    if v_row.status <> 'failed' then
      update public.messages
         set delivery_error = p_error
       where id = v_row.message_id
         and delivery_status is distinct from 'sent';
    end if;
    return;
  end if;

  v_external_id := case
    when coalesce(p_tg_message_id, v_row.tg_message_id) is not null
    then v_row.chat_id || ':' || coalesce(p_tg_message_id, v_row.tg_message_id)::text
  end;

  begin
    update public.messages
       set external_id     = coalesce(v_external_id, external_id),
           delivery_status = 'sent',
           delivery_error  = null
     where id = v_row.message_id;
  exception when unique_violation then
    delete from public.messages
     where id = v_row.message_id
       and external_id is null;
  end;
end;
$$;

revoke all on function public.complete_telegram_outbox(uuid, boolean, bigint, text, boolean) from public;
grant execute on function public.complete_telegram_outbox(uuid, boolean, bigint, text, boolean) to service_role;

-- Telegram's own service account (login codes, security notices) is not a
-- conversation with a customer, and login codes must not sit in a shared CRM.
-- telegram-poll no longer ingests it; the thread that is there is hidden by
-- its kind (20261031100000).
