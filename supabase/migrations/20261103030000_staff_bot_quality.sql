-- Xodim boti PR-9: AI takliflari sifati. Owner kuzatish rejimidagi takliflarni to'g'ri/noto'g'ri deb belgilaydi;
-- «Yoqilgan» rejimda xodimning ✅/❌ tanlovi o'zi baho. Maqsad (reja): aniqlik >= 90%.

alter table public.bot_proposals
  add column if not exists review text check (review in ('correct', 'wrong')),
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- Ko'rib chiqish ro'yxati (faqat owner): taklif + guruhdagi asl xabar + ismlar.
create or replace function public.bot_proposals_list(p_limit integer default 50)
returns table (
  id uuid, created_at timestamptz, kind text, mode text, status text, review text,
  title text, due_date timestamptz, priority text, confidence numeric, reason text,
  author_name text, assignee_name text, source_text text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role((select auth.uid()), 'owner'::public.app_role) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return query
  select p.id, p.created_at, p.kind, p.mode, p.status, p.review,
         p.title, p.due_date, p.priority, p.confidence, p.reason,
         coalesce(a.full_name, '—'), coalesce(s.full_name, '—'), m.text
  from public.bot_proposals p
  left join public.profiles a on a.user_id = p.author_user_id
  left join public.profiles s on s.user_id = p.assignee_user_id
  left join public.staff_group_messages m on m.chat_id = p.chat_id and m.message_id = p.source_message_id
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- Baho qo'yish yoki olib tashlash (p_verdict = null).
create or replace function public.bot_proposal_review(p_id uuid, p_verdict text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role((select auth.uid()), 'owner'::public.app_role) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  if p_verdict is not null and p_verdict not in ('correct', 'wrong') then
    raise exception 'bad verdict' using errcode = '22023';
  end if;
  update public.bot_proposals
     set review = p_verdict,
         reviewed_by = case when p_verdict is null then null else (select auth.uid()) end,
         reviewed_at = case when p_verdict is null then null else now() end
   where id = p_id;
end;
$$;

-- Sifat ko'rsatkichlari (oxirgi N kun). Baho: owner bahosi, bo'lmasa «Yoqilgan» rejimdagi accepted/rejected.
create or replace function public.bot_quality_stats(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  if not public.has_role((select auth.uid()), 'owner'::public.app_role) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  with p as (
    select *,
      coalesce(review,
        case when status = 'accepted' then 'correct' when status = 'rejected' then 'wrong' end) as verdict
    from public.bot_proposals
    where created_at >= now() - make_interval(days => greatest(coalesce(p_days, 7), 1))
  )
  select jsonb_build_object(
    'days', greatest(coalesce(p_days, 7), 1),
    'messages', (select count(*) from public.staff_group_messages
                  where created_at >= now() - make_interval(days => greatest(coalesce(p_days, 7), 1))),
    'proposals', (select count(*) from p),
    'shadow', (select count(*) from p where mode = 'shadow'),
    'on', (select count(*) from p where mode = 'on'),
    'judged', (select count(*) from p where verdict is not null),
    'correct', (select count(*) from p where verdict = 'correct'),
    'wrong', (select count(*) from p where verdict = 'wrong'),
    'unjudged', (select count(*) from p where verdict is null),
    'precision', (select case when count(*) filter (where verdict is not null) = 0 then null
                          else round(100.0 * count(*) filter (where verdict = 'correct')
                                     / count(*) filter (where verdict is not null)) end from p)
  ) into r;
  return r;
end;
$$;

revoke all on function public.bot_proposals_list(integer) from public, anon;
revoke all on function public.bot_proposal_review(uuid, text) from public, anon;
revoke all on function public.bot_quality_stats(integer) from public, anon;
grant execute on function public.bot_proposals_list(integer) to authenticated;
grant execute on function public.bot_proposal_review(uuid, text) to authenticated;
grant execute on function public.bot_quality_stats(integer) to authenticated;
