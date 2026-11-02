-- Xodim boti PR-11: ofis TV (hanguk.uz/tv) endi Orbit emas, Hanguk CRM vazifalaridan.
-- 1) TV kaliti (raqamli — TV pulti bilan kiritiladi), faqat owner ko'radi.
-- 2) tv_board_data(): TV javobi (oldingi Orbit tv-board bilan bir xil shakl).
-- 3) Orbit'ga sinxron triggerlari TO'XTATILADI (o'chirilmaydi; qayta yoqish: alter table ... enable trigger ...).

insert into public.bot_settings (key, value)
select 'tv_key', lpad(((('x' || encode(extensions.gen_random_bytes(5), 'hex'))::bit(40)::bigint) % 10000000000)::text, 10, '0')
on conflict (key) do nothing;

-- tv_key'ni faqat owner o'qiydi; qolgan sozlamalar avvalgidek.
drop policy if exists bot_settings_select on public.bot_settings;
create policy bot_settings_select on public.bot_settings
  for select to authenticated
  using (public.is_non_investor_staff()
         and (key <> 'tv_key' or public.has_role((select auth.uid()), 'owner'::public.app_role)));

create or replace function public.tv_board_data()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select (now() at time zone 'Asia/Tashkent')::date as today,
           (date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent') as d0
  ), s as (
    select distinct ur.user_id
    from public.user_roles ur
    where ur.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
  ), open_t as (
    select t.assigned_to, t.title, t.status, t.priority, t.created_at,
           (t.due_date at time zone 'Asia/Tashkent')::date as due
    from public.tasks t join s on s.user_id = t.assigned_to
    where t.status in ('todo', 'in_progress')
  ), done_t as (
    select t.assigned_to, t.title, t.completed_at
    from public.tasks t join s on s.user_id = t.assigned_to, b
    where t.status = 'completed' and t.completed_at >= b.d0
  ), people as (
    select coalesce(nullif(trim(p.full_name), ''), '—') as name,
      (select coalesce(jsonb_agg(jsonb_build_object(
                 'title', o.title,
                 'due', o.due,
                 'days', case when o.due is null then null else o.due - b.today end,
                 'wip', o.status = 'in_progress',
                 'hi', o.priority in ('urgent', 'high'))
               order by o.due nulls last, o.created_at), '[]'::jsonb)
         from open_t o, b where o.assigned_to = s.user_id) as tasks,
      (select coalesce(jsonb_agg(jsonb_build_object('title', d.title) order by d.completed_at desc), '[]'::jsonb)
         from done_t d where d.assigned_to = s.user_id) as done
    from s left join public.profiles p on p.user_id = s.user_id
  )
  select jsonb_build_object(
    'ok', true,
    'now', now(),
    'title', 'HANGUK',
    'people', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'tasks', tasks, 'done', done) order by name), '[]'::jsonb) from people),
    'counts', jsonb_build_object(
      'open', (select count(*) from open_t),
      'overdue', (select count(*) from open_t, b where open_t.due < b.today),
      'today', (select count(*) from open_t, b where open_t.due = b.today),
      'done', (select count(*) from done_t)));
$$;

revoke all on function public.tv_board_data() from public, anon, authenticated;
grant execute on function public.tv_board_data() to service_role;

-- Orbit to'xtatilgan (2026-10-28): har vazifa o'zgarishida unga ketayotgan so'rovlar endi kerak emas.
alter table public.tasks disable trigger trg_orbit_instant_sync;
alter table public.tasks disable trigger trg_orbit_signal;
alter table public.leads disable trigger trg_orbit_signal;
alter table public.payments disable trigger trg_orbit_signal;
