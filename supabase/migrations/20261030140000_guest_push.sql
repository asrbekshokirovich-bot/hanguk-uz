-- Push to guests (plan v2, stage 5 app/guest-push; B3 — «telefon qoldirmagan
-- mehmonga push, ruxsat so'rab — ha»). Until now a phone could receive a push
-- only once a student signed in on it (user_push_tokens needs a user); a
-- guest who never left a phone could not be reached again (K13).
--   * app_guest_push_tokens — the token a guest's phone registers after it
--     says yes to notifications, with the phone's install id and language.
--   * app_push_token_register — the app's call (anon), by install id, as the
--     analytics calls are.
--   * push_campaigns — what was sent to guests, by campaign key; the app
--     records push_opened with that key, so opens are counted per campaign.
--   * analytics_push_campaigns — guests reachable, and each campaign: sent,
--     delivered, opened.
-- Sending is send-guest-push (owner and admin).

create table if not exists public.app_guest_push_tokens (
  token          text primary key check (length(token) between 20 and 4096),
  install_id     uuid not null references public.app_installs (install_id) on delete cascade,
  platform       text not null check (platform in ('android', 'ios', 'web')),
  preferred_lang text not null default 'uz' check (preferred_lang in ('uz', 'ru', 'en', 'ko', 'vi')),
  app_version    text,
  enabled        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists app_guest_push_tokens_install_idx on public.app_guest_push_tokens (install_id);
-- Nobody reads it directly: the app writes through the function below, the
-- CRM sees counts through analytics_push_campaigns.
alter table public.app_guest_push_tokens enable row level security;

create or replace function public.app_push_token_register(
  p_install_id uuid, p_platform text, p_token text, p_lang text default 'uz', p_app_version text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_lang text := lower(left(coalesce(p_lang, 'uz'), 2));
begin
  if p_install_id is null or p_token is null or length(p_token) not between 20 and 4096
     or coalesce(p_platform, '') not in ('android', 'ios', 'web') then
    return jsonb_build_object('status', 'bad_input');
  end if;
  if not exists (select 1 from public.app_installs i where i.install_id = p_install_id) then
    return jsonb_build_object('status', 'unknown_install');
  end if;
  if v_lang not in ('uz', 'ru', 'en', 'ko', 'vi') then
    v_lang := 'uz';
  end if;
  insert into public.app_guest_push_tokens as t (token, install_id, platform, preferred_lang, app_version)
  values (p_token, p_install_id, p_platform, v_lang, left(p_app_version, 40))
  on conflict (token) do update
     set install_id = excluded.install_id, platform = excluded.platform,
         preferred_lang = excluded.preferred_lang, app_version = excluded.app_version,
         enabled = true, updated_at = now();
  -- a phone keeps its three newest tokens at most
  delete from public.app_guest_push_tokens t
   where t.install_id = p_install_id
     and t.token not in (select x.token from public.app_guest_push_tokens x
                          where x.install_id = p_install_id order by x.updated_at desc limit 3);
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.app_push_token_register(uuid, text, text, text, text) from public;
grant execute on function public.app_push_token_register(uuid, text, text, text, text) to anon, authenticated;

create table if not exists public.push_campaigns (
  id         uuid primary key default gen_random_uuid(),
  campaign   text not null unique check (campaign ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  audience   text not null default 'guests' check (audience in ('guests')),
  -- the text by language: {"uz": …, "ru": …}; Uzbek is required
  title      jsonb not null check (coalesce(title ->> 'uz', '') <> ''),
  body       jsonb not null check (coalesce(body ->> 'uz', '') <> ''),
  targeted   integer not null default 0,
  delivered  integer not null default 0,
  failed     integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
alter table public.push_campaigns enable row level security;
drop policy if exists push_campaigns_staff_read on public.push_campaigns;
create policy push_campaigns_staff_read on public.push_campaigns for select to authenticated
  using (public.app_events_staff_can_read());

-- Whom a guest campaign reaches: enabled guest tokens on phones nobody signed
-- in on, and not a token a signed-in student's phone also has.
create or replace function public.fn_guest_push_targets()
returns table (token text, install_id uuid, preferred_lang text)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select t.token, t.install_id, t.preferred_lang
    from public.app_guest_push_tokens t
    join public.app_installs i on i.install_id = t.install_id
   where t.enabled and i.user_id is null
     and not exists (select 1 from public.user_push_tokens u where u.token = t.token and u.enabled);
$$;

revoke all on function public.fn_guest_push_targets() from public, anon, authenticated;
grant execute on function public.fn_guest_push_targets() to service_role;

create or replace function public.analytics_push_campaigns()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'reachable', (select count(distinct g.install_id) from public.fn_guest_push_targets() g),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
               'campaign', c.campaign, 'title', c.title, 'body', c.body,
               'targeted', c.targeted, 'delivered', c.delivered, 'failed', c.failed,
               'created_at', c.created_at, 'sent_at', c.sent_at,
               'opened', (select count(distinct e.install_id) from public.app_events e
                           where e.event = 'push_opened' and e.props ->> 'campaign' = c.campaign
                             and e.occurred_at >= c.created_at))
             order by c.created_at desc)
        from public.push_campaigns c), '[]'::jsonb));
end;
$$;

revoke all on function public.analytics_push_campaigns() from public, anon;
grant execute on function public.analytics_push_campaigns() to authenticated;
