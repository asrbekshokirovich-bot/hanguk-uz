-- Hanguk AI 2.0 — 0-bosqich poydevori (reja: claude/hanguk-ai-reja.md, 9–10-bo'limlar).
--
--   ai_is_staff()      investor endi xodim hisoblanmaydi. Oldin user_roles'da
--                      har qanday qator (investor ham) staff agentini va barcha
--                      ai_* RPC'larni ochardi.
--   ai_runs            har savolga bitta qator: provayder, model, tool'lar,
--                      token, narx, vaqt, natija, baho. Matn saqlanmaydi.
--   ai_quota           kunlik / soatlik limit hisoblagichi (edge funksiya
--                      service role bilan ai_take_quota orqali yozadi).
--   ai_run_feedback()  foydalanuvchi o'z javobiga 👍/👎 qo'yadi.
--   retention cron     ai_runs 13 oy, ai_quota 3 kun saqlanadi.

create or replace function public.ai_is_staff(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null
     and exists (select 1 from public.user_roles ur
                  where ur.user_id = p_uid and ur.role::text <> 'investor');
$$;

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  audience text not null check (audience in ('staff', 'student', 'guest')),
  thread_id uuid references public.ai_threads(id) on delete set null,
  language text,
  provider text,
  model text,
  steps integer not null default 0,
  tool_calls jsonb not null default '[]'::jsonb,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  tokens_cached integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  latency_ms integer,
  outcome text not null check (outcome in ('ok', 'limit', 'quota', 'error', 'clarify', 'refused', 'empty')),
  sources_count integer not null default 0,
  error_text text,
  feedback smallint check (feedback in (-1, 1)),
  feedback_note text,
  feedback_at timestamptz
);

comment on table public.ai_runs is
  'Hanguk AI: one row per question (no message text). Written by hanguk-ai-chat with the service role; feedback via ai_run_feedback().';

create index if not exists ai_runs_created_idx on public.ai_runs (created_at desc);
create index if not exists ai_runs_user_idx on public.ai_runs (user_id, created_at desc);

alter table public.ai_runs enable row level security;

drop policy if exists ai_runs_select on public.ai_runs;
create policy ai_runs_select on public.ai_runs for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

revoke insert, update, delete on public.ai_runs from anon, authenticated;

create or replace function public.ai_run_feedback(p_run uuid, p_value integer, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if p_value not in (-1, 1) then
    raise exception 'feedback must be -1 or 1';
  end if;
  update ai_runs
     set feedback = p_value,
         feedback_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''),
         feedback_at = now()
   where id = p_run and user_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.ai_run_feedback(uuid, integer, text) from public, anon;
grant execute on function public.ai_run_feedback(uuid, integer, text) to authenticated;

create table if not exists public.ai_quota (
  key text primary key,
  count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.ai_quota is
  'Hanguk AI request counters. key = <who>:<bucket>, e.g. student:<uid>:2026-10-31. Service role only.';

alter table public.ai_quota enable row level security;
revoke all on public.ai_quota from anon, authenticated;

-- Atomically counts one request; false once p_limit is reached for the key.
create or replace function public.ai_take_quota(p_key text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  insert into ai_quota (key, count) values (p_key, 1)
  on conflict (key) do update set count = ai_quota.count + 1
  returning count into v;
  return v <= p_limit;
end;
$$;

revoke all on function public.ai_take_quota(text, integer) from public, anon, authenticated;
grant execute on function public.ai_take_quota(text, integer) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ai-runs-retention') then
    perform cron.unschedule('ai-runs-retention');
  end if;
end $$;

select cron.schedule(
  'ai-runs-retention',
  '23 3 * * *',
  $cron$
    delete from public.ai_runs where created_at < now() - interval '13 months';
    delete from public.ai_quota where created_at < now() - interval '3 days';
  $cron$
);

-- Talaba agenti uchun o'z kartasi (faqat auth.uid() = o'zi; xodim va
-- investor uchun emas). Ilovada ko'rinmaydigan narsalar (to'lovlar, qo'ng'iroq
-- xulosalari, xodim izohlari, vazifalar) bu yerda yo'q.
create or replace function public.ai_my_card()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null then
    raise exception 'not authorized: sign in first';
  end if;

  select jsonb_build_object(
    'student', jsonb_build_object(
      'full_name', p.full_name,
      'city', p.city,
      'language_track', p.language_track,
      'topik_level', p.topik_level,
      'ielts_score', p.ielts_score,
      'contract_date', p.contract_date),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object(
               'season', initcap(ik.season) || ' ' || ik.year,
               'contract_status', case when si.contract_cancelled_at is null then 'faol' else 'bekor qilingan' end,
               'stage', public.ai_stage_label(public.ai_board_stage(si.student_id, si.docs_ready)),
               'visa_approved_at', si.visa_approved_at::date,
               'departed_at', si.departed_at::date)
             order by ik.year desc, ik.season)
        from student_intakes si join intakes ik on ik.id = si.intake_id
       where si.student_id = v_uid), '[]'::jsonb),
    'document_pack', jsonb_build_object(
      'approved', (select count(*) from public.ai_pack_slots(v_uid) where state = 'tasdiqlangan'),
      'required', 8,
      'slots', (select jsonb_agg(jsonb_build_object('document', label, 'state', state))
                  from public.ai_pack_slots(v_uid))),
    'journey', public.my_application_journey()
  ) into v
  from profiles p
  where p.user_id = v_uid;

  return coalesce(v, jsonb_build_object('error', 'profile not found'));
end;
$$;

revoke all on function public.ai_my_card() from public, anon;
grant execute on function public.ai_my_card() to authenticated;
