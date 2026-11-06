-- Ushlab qolish rejasi P16 (U4, QU5): a guest whose phone has no push (an
-- iPhone on 1.1.0–1.1.1, or permission refused) can take the deadline
-- reminders in Telegram. The app gets a code for its install id and opens
-- t.me/<bot>?start=D_<code>; the bot ties the chat to the install. «To'xtatish»
-- in the bot turns it off. notify-guest-reminders (P09) sends by Telegram
-- when the phone has no push token.

create table if not exists public.app_telegram_subs (
  install_id  uuid primary key references public.app_installs (install_id) on delete cascade,
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  chat_id     text,
  lang        text not null default 'uz' check (lang in ('uz', 'ru', 'en', 'ko', 'vi')),
  enabled     boolean not null default false,
  created_at  timestamptz not null default now(),
  linked_at   timestamptz,
  stopped_at  timestamptz
);
create index if not exists app_telegram_subs_chat_idx on public.app_telegram_subs (chat_id);
alter table public.app_telegram_subs enable row level security;
drop policy if exists app_telegram_subs_staff_read on public.app_telegram_subs;
create policy app_telegram_subs_staff_read on public.app_telegram_subs
  for select to authenticated using (public.app_events_staff_can_read());

-- The app's call (anon): this phone's code, made once.
create or replace function public.app_telegram_sub_code(p_install_id uuid, p_lang text default 'uz')
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_lang text := lower(left(coalesce(p_lang, 'uz'), 2));
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if p_install_id is null or not exists (select 1 from public.app_installs i where i.install_id = p_install_id) then
    return jsonb_build_object('status', 'unknown_install');
  end if;
  if v_lang not in ('uz', 'ru', 'en', 'ko', 'vi') then v_lang := 'uz'; end if;
  select s.code into v_code from public.app_telegram_subs s where s.install_id = p_install_id;
  if v_code is null then
    loop
      v_code := (select string_agg(substr(v_alpha, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 10));
      begin
        insert into public.app_telegram_subs (install_id, code, lang) values (p_install_id, v_code, v_lang);
        exit;
      exception when unique_violation then
        if exists (select 1 from public.app_telegram_subs s where s.install_id = p_install_id) then
          select s.code into v_code from public.app_telegram_subs s where s.install_id = p_install_id;
          exit;
        end if;
      end;
    end loop;
  else
    update public.app_telegram_subs set lang = v_lang where install_id = p_install_id;
  end if;
  return jsonb_build_object('status', 'ok', 'code', v_code,
    'linked', exists (select 1 from public.app_telegram_subs s where s.install_id = p_install_id and s.enabled));
end;
$$;
revoke all on function public.app_telegram_sub_code(uuid, text) from public;
grant execute on function public.app_telegram_sub_code(uuid, text) to anon, authenticated;

-- The bot's calls (service role).
create or replace function public.telegram_sub_link(p_code text, p_chat_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_row public.app_telegram_subs;
begin
  update public.app_telegram_subs
     set chat_id = p_chat_id, enabled = true, linked_at = now(), stopped_at = null
   where code = upper(p_code)
  returning * into v_row;
  if v_row.install_id is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'lang', v_row.lang);
end;
$$;

create or replace function public.telegram_sub_stop(p_chat_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_n int;
  v_lang text;
begin
  update public.app_telegram_subs set enabled = false, stopped_at = now()
   where chat_id = p_chat_id and enabled;
  get diagnostics v_n = row_count;
  select s.lang into v_lang from public.app_telegram_subs s where s.chat_id = p_chat_id limit 1;
  update public.guest_push_queue q set status = 'skipped', note = 'telegram_stopped'
   where q.status = 'pending'
     and q.install_id in (select s.install_id from public.app_telegram_subs s where s.chat_id = p_chat_id)
     and not exists (select 1 from public.fn_guest_push_targets() g where g.install_id = q.install_id);
  return jsonb_build_object('ok', v_n > 0, 'lang', coalesce(v_lang, 'uz'));
end;
$$;
revoke all on function public.telegram_sub_link(text, text) from public, anon, authenticated;
revoke all on function public.telegram_sub_stop(text) from public, anon, authenticated;
grant execute on function public.telegram_sub_link(text, text) to service_role;
grant execute on function public.telegram_sub_stop(text) to service_role;

-- Phones a reminder may go to now include a Telegram subscription.
create or replace function public.fn_guest_reminder_installs()
returns table (install_id uuid)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select g.install_id
    from public.fn_guest_push_targets() g
    join public.app_guest_push_tokens t on t.token = g.token
   where t.reminders
  union
  select s.install_id
    from public.app_telegram_subs s
    join public.app_installs i on i.install_id = s.install_id
   where s.enabled and s.chat_id is not null and i.user_id is null;
$$;
revoke all on function public.fn_guest_reminder_installs() from public, anon, authenticated;

-- …and what notify-guest-reminders reads carries the Telegram chat; a phone
-- with a push token is still sent by push.
drop function if exists public.guest_push_pending(int);
create or replace function public.guest_push_pending(p_limit int default 500)
returns table (
  queue_id bigint, install_id uuid, kind text, institution_id uuid, ref_date date,
  lang text, tokens text[], tg_chat text, is_test boolean, sent_today int, sent_7d int)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  with tok as (
    select g.install_id, array_agg(g.token order by t.updated_at desc) as tokens,
           (array_agg(g.preferred_lang order by t.updated_at desc))[1] as lang
      from public.fn_guest_push_targets() g
      join public.app_guest_push_tokens t on t.token = g.token
     where t.reminders
     group by g.install_id
  ),
  tg as (
    select s.install_id, s.chat_id, s.lang
      from public.app_telegram_subs s
     where s.enabled and s.chat_id is not null
  ),
  sent as (
    select s.install_id,
           count(*) filter (where (s.sent_at at time zone 'Asia/Tashkent')::date
                                  = (now() at time zone 'Asia/Tashkent')::date)::int as today,
           count(*)::int as d7
      from public.app_push_sends s
     where s.audience = 'guest' and s.status = 'sent' and s.campaign is null
       and s.sent_at > now() - interval '7 days'
     group by s.install_id
  )
  select q.id, q.install_id, q.kind, q.institution_id, q.ref_date,
         coalesce(tok.lang, tg.lang), coalesce(tok.tokens, '{}'), tg.chat_id, (i.test_reason is not null),
         coalesce(sent.today, 0), coalesce(sent.d7, 0)
    from public.guest_push_queue q
    join public.app_installs i on i.install_id = q.install_id
    left join tok on tok.install_id = q.install_id
    left join tg on tg.install_id = q.install_id
    left join sent on sent.install_id = q.install_id
   where q.status = 'pending' and i.user_id is null
     and (tok.install_id is not null or tg.install_id is not null)
   order by q.install_id, q.ref_date, q.kind
   limit greatest(1, least(coalesce(p_limit, 500), 5000));
$$;
revoke all on function public.guest_push_pending(int) from public, anon, authenticated;
grant execute on function public.guest_push_pending(int) to service_role;
