-- Xodim boti guruh tarixi — semantik qidiruv (reja B3-2). ai_team_history_search
-- (20261106120000_ai_team_tools.sql) faqat ILIKE leksik qidiruv edi; bu migratsiya
-- Voyage AI embedding + pgvector bilan ma'no bo'yicha qidiruvni qo'shadi, lexical'ga
-- tegmaydi (ikkisi parallel ishlaydi, hanguk-ai-chat tool'i tanlaydi).
--
--   staff_group_messages.embedding   vector(1024) (voyage-4, _shared/voyage.ts bilan bir xil).
--   trg_staff_group_messages_embed   AFTER INSERT — yangi xabarni bot_jobs'ga ('group_embed') qo'yadi.
--   bot_embed_set                    (service_role) — staff-bot/embed.ts ishi vektorni yozadi.
--   bot_embed_backfill_claim         (service_role) — eski (jadval yaratilgunga qadar yozilgan)
--                                    xabarlarni partiyalab qaytaradi (?action=embed_backfill).
--   ai_team_history_search_semantic  (owner) — ai_team_history_search bilan bir xil filtrlar,
--                                    lekin cosine masofa bo'yicha tartiblaydi. VOYAGE_API_KEY
--                                    narxi: rasmiy narxni tekshirish kerak (bu yerda yozilmaydi).
--
-- Eslatma: VOYAGE_API_KEY bo'lmasa ustun bo'sh qoladi — hech narsa buzilmaydi,
-- ai_team_history_search (leksik) ishlashda davom etadi.

create extension if not exists vector;

alter table public.staff_group_messages
  add column if not exists embedding public.vector(1024),
  add column if not exists embedded_at timestamptz;

-- ivfflat bo'sh jadvalda ma'nosiz; HNSW o'qitilmasdan ishlaydi (guideline_text_index'dagi kabi).
create index if not exists staff_group_messages_embedding_hnsw
  on public.staff_group_messages using hnsw (embedding public.vector_cosine_ops)
  with (m = '16', ef_construction = '64');

-- ── yangi xabar → navbat ────────────────────────────────────────────────────

create or replace function public.trg_staff_group_messages_embed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.text is not null and btrim(new.text) <> '' and new.user_id is not null
     and coalesce(new.kind, 'message') <> 'command'
     and not public.fn_is_demo_user(new.user_id) then
    perform public.bot_job_enqueue(
      'group_embed',
      'ge:' || new.id::text,
      jsonb_build_object('message_id', new.id, 'text', left(new.text, 8000)),
      null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists staff_group_messages_embed on public.staff_group_messages;
create trigger staff_group_messages_embed
  after insert on public.staff_group_messages
  for each row execute function public.trg_staff_group_messages_embed();

-- ── staff-bot/embed.ts uchun RPC'lar (service_role) ─────────────────────────

create or replace function public.bot_embed_set(p_message_id uuid, p_embedding public.vector(1024))
returns void
language sql
security definer
set search_path = public
as $$
  update public.staff_group_messages
     set embedding = p_embedding, embedded_at = now()
   where id = p_message_id;
$$;

-- Hali vektorlanmagan (yoki jadval yaratilishidan oldingi) xabarlarni partiyalab qaytaradi.
create or replace function public.bot_embed_backfill_claim(p_limit integer default 50)
returns table (id uuid, text text)
language sql
security definer
set search_path = public
set statement_timeout = '8s'
as $$
  select g.id, g.text
    from public.staff_group_messages g
   where g.embedding is null
     and g.text is not null and btrim(g.text) <> ''
     and g.user_id is not null
     and coalesce(g.kind, 'message') <> 'command'
     and not public.fn_is_demo_user(g.user_id)
   order by g.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.bot_embed_set(uuid, public.vector) from public, anon, authenticated;
revoke all on function public.bot_embed_backfill_claim(integer) from public, anon, authenticated;
grant execute on function public.bot_embed_set(uuid, public.vector) to service_role;
grant execute on function public.bot_embed_backfill_claim(integer) to service_role;

-- ── semantik qidiruv (owner, ai_team_history_search bilan bir xil ruxsat/filtr) ─

create or replace function public.ai_team_history_search_semantic(
  p_embedding public.vector(1024),
  p_from date default null,
  p_to date default null,
  p_staff text default null,
  p_limit int default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
set statement_timeout = '8s'
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_rows jsonb;
  v_from date := p_from;
  v_to date := coalesce(p_to, public.tashkent_today());
begin
  if v_uid is null or not public.has_role(v_uid, 'owner'::public.app_role) then
    raise exception 'not authorized: owner only';
  end if;
  if p_embedding is null then
    return jsonb_build_object('error', 'embedding is required');
  end if;

  begin
    perform set_config('hnsw.ef_search', '100', true);
  exception when undefined_object then
    null;
  end;

  with m as (
    select g.created_at, g.chat_id, g.message_id, g.text,
           coalesce(nullif(trim(p.full_name), ''), '—') as name,
           g.embedding <=> p_embedding as dist
      from public.staff_group_messages g
      join public.profiles p on p.user_id = g.user_id
     where g.user_id is not null
       and g.embedding is not null
       and g.text is not null
       and coalesce(g.kind, 'message') <> 'command'
       and not public.fn_is_demo_user(g.user_id)
       and (v_from is null or public.ai_tk_day(g.created_at) >= v_from)
       and public.ai_tk_day(g.created_at) <= v_to
       and (p_staff is null
            or public.hanguk_fold_name(p.full_name) like '%' || public.hanguk_fold_name(p_staff) || '%')
     order by g.embedding <=> p_embedding
     limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'at', to_char(m.created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI'),
           'name', m.name,
           'voice', m.text like '🎤%',
           'similarity', round((1 - m.dist)::numeric, 3),
           'snippet', left(m.text, 300) || case when length(m.text) > 300 then '…' else '' end,
           'link', case when m.chat_id < -1000000000000
                        then 'https://t.me/c/' || ((-m.chat_id) - 1000000000000)::text || '/' || m.message_id end
         )) order by m.dist), '[]'::jsonb)
    into v_rows
    from m;

  return jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'results', v_rows,
    'note', 'Ma''no bo''yicha qidiruv (Voyage embedding); faqat vektorlangan xabarlar qamrab olinadi. '
            || 'Faqat botga ulangan xodimlar xabarlari; guruh tarixi 90 kun saqlanadi.');
end;
$$;

revoke all on function public.ai_team_history_search_semantic(public.vector, date, date, text, int) from public, anon;
grant execute on function public.ai_team_history_search_semantic(public.vector, date, date, text, int) to authenticated, service_role;
