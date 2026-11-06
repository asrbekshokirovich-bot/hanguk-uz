-- Xodim boti B5-1/B5-2: AI "on" rejimi kengaytirildi (update_task takliflari) va vazifani talabaga
-- biriktirish («/talaba <ism>»).
--
-- B5-1: bot_analyses.mode allaqachon off|shadow|on (bot_settings.group_ai_mode, 20261102230000) va
-- `on` bo'lganda new_task/close_task uchun guruhga taklif kartasi yuboradi (card confirm/reject,
-- 20261102230000 + index.ts onProposalCallback). Shu yerda qo'shiladi:
--   - bot_proposals.kind endi 'update' ni ham qabul qiladi (muddat o'zgarishi taklifi);
--   - takliflar kartasi faqat yuqori ishonchda (ANALYSIS_ON_CONFIDENCE, kodda 0.8) guruhga chiqadi —
--     past bo'lsa `on` rejimida ham faqat yoziladi (status='shadow'), xuddi shadow rejimidagi kabi.
--     (Bu chegara core.ts'da, bazaga tegmaydi — shu izoh hujjat uchun.)
--
-- B5-2 (soddalashtirilgan — reja B5-2'dagi takrorlanuvchi vazifalar KEYINGI PR'ga qoldirildi):
--   tasks.student_id ustuni allaqachon bor (20260104080923). Yangi:
--   - bot_set_task_student(p_actor, p_task, p_student, p_via) — mas'ul/bergan/owner talaba biriktiradi
--     (search_students RPC orqali topilgan), task_events'ga kind='student' yoziladi.
-- Qayta qo'llash xavfsiz (if not exists / or replace / drop ... add).

-- ── bot_proposals: 'update' turi ─────────────────────────────────────────

alter table public.bot_proposals drop constraint if exists bot_proposals_kind_check;
alter table public.bot_proposals add constraint bot_proposals_kind_check
  check (kind in ('create', 'close', 'update'));

-- ── task_events: 'student' voqeasi ────────────────────────────────────────

alter table public.task_events drop constraint if exists task_events_kind_check;
alter table public.task_events add constraint task_events_kind_check
  check (kind in ('created', 'status', 'assignee', 'due', 'priority', 'title', 'comment', 'reminder', 'notified', 'student'));

-- ── talaba biriktirish ─────────────────────────────────────────────────────

create or replace function public.bot_set_task_student(
  p_actor uuid, p_task uuid, p_student uuid, p_via text default 'dm'
)
returns table (result text, title text, student_name text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  t record;
  v_name text;
begin
  if p_via not in ('dm', 'group') then
    raise exception 'bad via' using errcode = '22023';
  end if;
  select * into t from public.tasks where id = p_task;
  if not found then
    return query select 'not_found'::text, null::text, null::text; return;
  end if;
  if not (t.assigned_to = p_actor or t.created_by = p_actor
          or public.has_role(p_actor, 'owner'::public.app_role)) then
    return query select 'not_allowed'::text, t.title, null::text; return;
  end if;
  if not exists (select 1 from public.profiles where user_id = p_student and role = 'student') then
    return query select 'bad_student'::text, t.title, null::text; return;
  end if;
  select coalesce(nullif(trim(full_name), ''), '—') into v_name from public.profiles where user_id = p_student;
  if t.student_id is distinct from p_student then
    update public.tasks set student_id = p_student, updated_at = now() where id = p_task;
    insert into public.task_events (task_id, actor_user_id, kind, via, payload)
    values (p_task, p_actor, 'student', p_via, jsonb_build_object('from', t.student_id, 'to', p_student, 'name', v_name));
  end if;
  return query select 'ok'::text, t.title, v_name;
end;
$$;

revoke all on function public.bot_set_task_student(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.bot_set_task_student(uuid, uuid, uuid, text) to service_role;
