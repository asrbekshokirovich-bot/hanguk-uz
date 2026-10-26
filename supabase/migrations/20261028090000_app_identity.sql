-- App analytics, stage 2: who is behind an installation, and where the person
-- says they found us (decisions S3, B2, B4 of 2026-10-22).
--
-- * lead_how_heard (+ lead_how_heard_aliases, fn_how_heard_key): «Bizni
--   qayerdan topdingiz?» — the eight answers of the marketing plan's form
--   (2026-10-22: Instagram · Telegram · Do'st yoki qarindosh tavsiyasi ·
--   Koreyada o'qiyotgan tanish · O'quv markazi · Tadbir · Play Market yoki
--   App Store · Boshqa) with stable keys, and what the CRM's intake form
--   (src/components/crm/leads/intake/options.ts) and older forms left in
--   leads.how_heard mapped onto them. The analytics count channels by the
--   person's own answer only (S3) and show these eight rows plus "unknown"; a
--   guest who never answered stays "unknown".
-- * leads.for_whom: «Kim uchun?» — self, child, relative (the plan's S4).
-- * app_identity: each time a device is tied to a person, and how — the lead
--   form, an operator's link (opened with the app installed, installed from
--   Google Play with it, or opened on the web), the code in a Telegram
--   message, the bot's start button. app_installs.lead_id keeps the latest.
-- * app_contact_codes: the short code the app writes into the text of a
--   Telegram message to the consultant («Ilovadan · 7Q2MXA», as the plan's
--   example has it; the bot's button sends "HK-7Q2MXA"). The person sends it, the
--   chat becomes (or is) a lead, and the device that wrote it is tied to that
--   lead. A code lives 30 days. The code only ties the person — it is not a
--   source (S3).
-- * app_identity_claim(install, link code, via): the app found a lead's link
--   code — an operator sent the person hanguk.uz/l/<code> (B2: the operator
--   decides to whom).
-- * app_contact_code(install): the device's open code (made when needed).
-- * fn_contact_code_link(text, lead, via): telegram-ingest and the bot find a
--   code in a message and tie the device to the lead. Service role only.
-- * app_quiz_submit: the lead form also sends how_heard and for_whom.
-- * app_install_link_lead: the lead form's link is recorded in app_identity.

-- 1. «Bizni qayerdan topdingiz?» --------------------------------------------------------
create table if not exists public.lead_how_heard (
  key       text primary key check (key ~ '^[a-z_]{2,32}$'),
  label_uz  text not null unique,
  sort      int not null,
  -- offered on the app's form (the CRM keeps every option)
  in_app    boolean not null default true
);

comment on table public.lead_how_heard is
  '«Bizni qayerdan topdingiz?» answers: label_uz is what the app''s form stores in leads.how_heard; lead_how_heard_aliases maps the CRM''s own wording.';

insert into public.lead_how_heard (key, label_uz, sort, in_app) values
  ('instagram',       'Instagram',                       1, true),
  ('telegram',        'Telegram',                        2, true),
  ('friend',          'Do''st yoki qarindosh tavsiyasi', 3, true),
  ('korea_friend',    'Koreyada o''qiyotgan tanish',     4, true),
  ('learning_center', 'O''quv markazi',                  5, true),
  ('event',           'Tadbir',                          6, true),
  ('store',           'Play Market yoki App Store',      7, true),
  ('other',           'Boshqa',                          8, true)
on conflict (key) do update
   set label_uz = excluded.label_uz, sort = excluded.sort, in_app = excluded.in_app;

create table if not exists public.lead_how_heard_aliases (
  raw text primary key,
  key text not null references public.lead_how_heard (key)
);

-- What the CRM's intake form and older forms (the add-lead wizard, the bot)
-- leave in leads.how_heard. «Ijtimoiy tarmoq reklamasi» is the Instagram
-- adverts (2026-10-26: 533 of its 542 leads came through Instagram); Google and
-- YouTube / TikTok have no row of their own, so they count as «Boshqa».
insert into public.lead_how_heard_aliases (raw, key) values
  ('Ijtimoiy tarmoq reklamasi',  'instagram'),
  ('Instagram sahifasi',         'instagram'),
  ('Telegram kanali',            'telegram'),
  ('Telegram bot',               'telegram'),
  ('Do‘sti / tanishi tavsiyasi', 'friend'),
  ('Tadbir yoki ko‘rgazma',      'event'),
  ('O‘quv markaz',               'learning_center'),
  ('Google qidiruv',             'other'),
  ('YouTube / TikTok',           'other'),
  ('social_media',               'instagram'),
  ('advertisement',              'instagram'),
  ('friend_referral',            'friend'),
  ('search_engine',              'other'),
  ('event',                      'event'),
  ('other',                      'other')
on conflict (raw) do update set key = excluded.key;

-- The option a how_heard value means; null when the person never answered.
create or replace function public.fn_how_heard_key(p_value text)
returns text
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select case
           when nullif(btrim(coalesce(p_value, '')), '') is null then null
           else coalesce(
             (select h.key from public.lead_how_heard h where h.label_uz = btrim(p_value)),
             (select a.key from public.lead_how_heard_aliases a where a.raw = btrim(p_value)),
             'other')
         end;
$$;

alter table public.lead_how_heard enable row level security;
alter table public.lead_how_heard_aliases enable row level security;
drop policy if exists lead_how_heard_read on public.lead_how_heard;
create policy lead_how_heard_read on public.lead_how_heard for select to authenticated using (true);
drop policy if exists lead_how_heard_aliases_read on public.lead_how_heard_aliases;
create policy lead_how_heard_aliases_read on public.lead_how_heard_aliases for select to authenticated using (true);

-- 2. «Kim uchun?» ---------------------------------------------------------------------
alter table public.leads
  add column if not exists for_whom text
    check (for_whom is null or for_whom in ('self', 'child', 'relative'));

comment on column public.leads.for_whom is '«Kim uchun?»: self, child, relative (the person''s own answer).';

-- 3. Device ↔ person ----------------------------------------------------------------
create table if not exists public.app_identity (
  id          bigint generated always as identity primary key,
  install_id  uuid not null references public.app_installs (install_id) on delete cascade,
  lead_id     uuid not null references public.leads (id) on delete cascade,
  via         text not null check (via in ('form', 'link', 'referrer', 'web', 'telegram_code', 'bot_start')),
  created_at  timestamptz not null default now(),
  unique (install_id, lead_id, via)
);

create index if not exists app_identity_lead_idx on public.app_identity (lead_id, created_at desc);
create index if not exists app_identity_install_idx on public.app_identity (install_id, created_at desc);

create table if not exists public.app_contact_codes (
  code        text primary key check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  install_id  uuid not null references public.app_installs (install_id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  used_at     timestamptz,
  lead_id     uuid references public.leads (id) on delete set null
);

create index if not exists app_contact_codes_install_idx on public.app_contact_codes (install_id, created_at desc);

alter table public.app_identity enable row level security;
alter table public.app_contact_codes enable row level security;
drop policy if exists app_identity_staff_read on public.app_identity;
create policy app_identity_staff_read on public.app_identity for select to authenticated
  using (public.app_events_staff_can_read());
drop policy if exists app_contact_codes_staff_read on public.app_contact_codes;
create policy app_contact_codes_staff_read on public.app_contact_codes for select to authenticated
  using (public.app_events_staff_can_read());

-- The device's open code, made when it has none (at most 20 a day).
create or replace function public.app_contact_code(p_install_id uuid)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_code      text;
  v_alphabet  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes     bytea;
begin
  if p_install_id is null then
    return null;
  end if;
  select c.code into v_code
    from public.app_contact_codes c
   where c.install_id = p_install_id and c.used_at is null and c.expires_at > now()
   order by c.created_at desc
   limit 1;
  if v_code is not null then
    return v_code;
  end if;
  if (select count(*) from public.app_contact_codes c
       where c.install_id = p_install_id and c.created_at > now() - interval '1 day') >= 20 then
    return null;
  end if;
  -- The button may be pressed before the app's first batch made the row.
  insert into public.app_installs (install_id, platform) values (p_install_id, 'other')
  on conflict (install_id) do nothing;
  for v_try in 1 .. 5 loop
    -- A version-4 uuid's random bytes (a CSPRNG), one letter each.
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0 .. 5 loop
      v_code := v_code || substr(v_alphabet, 1 + get_byte(v_bytes, i) % length(v_alphabet), 1);
    end loop;
    begin
      insert into public.app_contact_codes (code, install_id) values (v_code, p_install_id);
      return v_code;
    exception when unique_violation then
      null;
    end;
  end loop;
  return null;
end;
$$;

revoke all on function public.app_contact_code(uuid) from public;
grant execute on function public.app_contact_code(uuid) to anon, authenticated;

-- The app found a lead's link code: an operator's link (opened with the app
-- installed: 'link'; installed from Google Play with it: 'referrer'; the web
-- app opened with ?l=: 'web'). Link codes are 10 random characters, so a
-- device cannot guess its way onto someone's lead.
create or replace function public.app_identity_claim(p_install_id uuid, p_link_code text, p_via text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_code text := lower(btrim(coalesce(p_link_code, '')));
  v_lead uuid;
begin
  if p_install_id is null or v_code !~ '^[a-z0-9]{6,32}$' or coalesce(p_via, '') not in ('link', 'referrer', 'web') then
    return jsonb_build_object('status', 'bad');
  end if;
  select l.id into v_lead from public.leads l where l.link_code = v_code limit 1;
  if v_lead is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.app_installs as i (install_id, lead_id, platform)
  values (p_install_id, v_lead, 'other')
  on conflict (install_id) do update set lead_id = excluded.lead_id, last_seen_at = now();
  insert into public.app_identity (install_id, lead_id, via)
  values (p_install_id, v_lead, p_via)
  on conflict (install_id, lead_id, via) do nothing;
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.app_identity_claim(uuid, text, text) from public;
grant execute on function public.app_identity_claim(uuid, text, text) to anon, authenticated;

-- A message with the app's code in it — after the middle dot of «Ilovadan ·
-- 7Q2MXA» (in any of the app's languages) or as "HK-7Q2MXA" — came from the
-- device that made the code: tie that device to [p_lead_id]. Returns the
-- device, or null.
create or replace function public.fn_contact_code_link(p_text text, p_lead_id uuid, p_via text default 'telegram_code')
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_match   text[] := regexp_match(upper(coalesce(p_text, '')), '(?:HK-|·\s*)([A-HJKMNP-Z2-9]{6})(?![A-Z0-9])');
  v_via     text := case when p_via in ('telegram_code', 'bot_start') then p_via else 'telegram_code' end;
  v_install uuid;
begin
  if v_match is null or p_lead_id is null then
    return null;
  end if;
  update public.app_contact_codes c
     set used_at = coalesce(c.used_at, now()), lead_id = p_lead_id
   where c.code = v_match[1]
     and c.expires_at > now()
     and (c.lead_id is null or c.lead_id = p_lead_id)
  returning c.install_id into v_install;
  if v_install is null then
    return null;
  end if;
  update public.app_installs set lead_id = p_lead_id, last_seen_at = now() where install_id = v_install;
  insert into public.app_identity (install_id, lead_id, via)
  values (v_install, p_lead_id, v_via)
  on conflict (install_id, lead_id, via) do nothing;
  return v_install;
end;
$$;

revoke all on function public.fn_contact_code_link(text, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_contact_code_link(text, uuid, text) to service_role;

-- The lead form's link (the app calls this right after app_quiz_submit).
create or replace function public.app_install_link_lead(p_install_id uuid, p_link_code text)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_lead uuid;
begin
  if p_install_id is null or coalesce(btrim(p_link_code), '') = '' then
    return false;
  end if;
  select l.id into v_lead from public.leads l where l.link_code = lower(btrim(p_link_code)) limit 1;
  if v_lead is null then
    return false;
  end if;
  insert into public.app_installs as i (install_id, lead_id)
  values (p_install_id, v_lead)
  on conflict (install_id) do update set lead_id = excluded.lead_id, last_seen_at = now();
  insert into public.app_identity (install_id, lead_id, via)
  values (p_install_id, v_lead, 'form')
  on conflict (install_id, lead_id, via) do nothing;
  return true;
end;
$$;

-- Devices already tied by the form before this table existed.
insert into public.app_identity (install_id, lead_id, via, created_at)
select i.install_id, i.lead_id, 'form', i.last_seen_at
  from public.app_installs i
 where i.lead_id is not null
on conflict (install_id, lead_id, via) do nothing;

-- 4. The lead form's two questions -----------------------------------------------------
create or replace function public.app_quiz_submit(p_phone text, p_name text, p_answers jsonb, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_national text := public.fn_uz_national_phone(p_phone);
  v_phone    text;
  v_pretty   text;
  v_name     text := nullif(btrim(coalesce(p_name, '')), '');
  v_lead     public.leads%rowtype;
  v_lead_id  uuid;
  v_code     text;
  v_band     text := p_result ->> 'band';
  v_note     text;
  v_edu      text;
  v_cert     text;
  v_intake   text;
  v_age      int;
  v_heard    text;
  v_for      text;
begin
  if v_national is null then
    return jsonb_build_object('status', 'invalid_phone');
  end if;
  if v_name is null or length(v_name) > 80 then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
     or p_result is null or jsonb_typeof(p_result) <> 'object'
     or length(p_answers::text) > 4000 or length(p_result::text) > 20000 then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_band is not null and v_band not in ('high', 'mid', 'low') then
    v_band := null;
  end if;

  if public.fn_is_student_phone(v_national) then
    return jsonb_build_object('status', 'student');
  end if;

  v_phone := '+998' || v_national;
  v_pretty := '+998 ' || substr(v_national, 1, 2) || ' ' || substr(v_national, 3, 3)
           || ' ' || substr(v_national, 6, 2) || ' ' || substr(v_national, 8, 2);

  -- Answers mapped onto the CRM's own buckets (src/components/crm/leads/intake/options.ts).
  v_edu := case p_answers ->> 'route'
             when 'bachelor' then 'Bakalavr'
             when 'master'   then 'Magistr'
             when 'college'  then 'Kasbiy ta’lim'
           end;
  v_cert := case p_answers ->> 'korean'
              when 'none'       then 'Yo''q'
              when 'learning'   then 'Yo''q'
              when 'topik1'     then 'TOPIK 1'
              when 'topik2'     then 'TOPIK 2'
              when 'topik3plus' then 'TOPIK 3'
              when 'topik3'     then 'TOPIK 3'
              when 'topik4plus' then 'TOPIK 4'
            end;
  v_intake := case p_answers ->> 'intake'
                when '2027_spring' then 'Bahorgi 2027'
                when '2027_fall'   then 'Kuzgi 2027'
              end;
  v_age := case when (p_answers ->> 'age') ~ '^\d{1,2}$' then (p_answers ->> 'age')::int end;
  if v_age is not null and (v_age < 10 or v_age > 99) then v_age := null; end if;
  -- «Bizni qayerdan topdingiz?» and «Kim uchun?», when the form asked them.
  select h.label_uz into v_heard from public.lead_how_heard h where h.key = p_answers ->> 'how_heard' and h.in_app;
  v_for := case when p_answers ->> 'for_whom' in ('self', 'child', 'relative')
                then p_answers ->> 'for_whom' end;

  v_note := 'Ilovada imkoniyat testi: '
         || coalesce(case v_band when 'high' then 'yuqori' when 'mid' then 'o''rta' when 'low' then 'past' end, '—')
         || ' · ' || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM.YYYY HH24:MI');

  select l.* into v_lead
    from public.leads l
   where v_national = any (public.fn_phone_keys(l.phone))
   order by l.updated_at desc
   limit 1;

  if v_lead.id is not null then
    -- The same number pressing the button twice within a minute is one request.
    if v_lead.quiz_submitted_at is not null and v_lead.quiz_submitted_at > now() - interval '1 minute' then
      return jsonb_build_object('status', 'ok', 'phone', v_phone, 'link_code', v_lead.link_code);
    end if;
    update public.leads l
       set full_name = case when l.full_name is null or l.full_name like 'Ilova: %' then v_name else l.full_name end,
           notes = concat_ws(E'\n', nullif(trim(l.notes), ''), v_note),
           quiz_answers = p_answers,
           eligibility_result = p_result,
           eligibility_band = v_band,
           tariff_interest = p_result ->> 'tariff',
           needs_operator = coalesce((p_result ->> 'needs_operator')::boolean, false),
           quiz_submitted_at = now(),
           education_level = coalesce(v_edu, l.education_level),
           cert_level = coalesce(v_cert, l.cert_level),
           korean_level = coalesce(v_cert, l.korean_level),
           budget_range = coalesce(p_result ->> 'budget_label', l.budget_range),
           city = coalesce(nullif(p_answers ->> 'region', ''), l.city),
           age = coalesce(v_age, l.age),
           target_intake = coalesce(v_intake, l.target_intake),
           -- The person's own answer is the source (S3).
           how_heard = coalesce(v_heard, l.how_heard),
           for_whom = coalesce(v_for, l.for_whom),
           new_lead_at = now(),
           sla_start_at = public.fn_lead_sla_start(now()),
           sla_alerted_at = null,
           quick_contact_alerted_at = case when l.last_contacted_at is not null then now() end,
           updated_at = now()
     where l.id = v_lead.id
     returning l.id, l.link_code into v_lead_id, v_code;
  else
    insert into public.leads (full_name, phone, source, status, contact_channel, notes,
                              new_lead_at, sla_start_at,
                              quiz_answers, eligibility_result, eligibility_band, tariff_interest,
                              needs_operator, quiz_submitted_at,
                              education_level, cert_level, korean_level, budget_range, city, age, target_intake,
                              how_heard, for_whom)
    values (coalesce(v_name, 'Ilova: ' || v_pretty), v_phone, 'app', 'new', 'Ilova', v_note,
            now(), public.fn_lead_sla_start(now()),
            p_answers, p_result, v_band, p_result ->> 'tariff',
            coalesce((p_result ->> 'needs_operator')::boolean, false), now(),
            v_edu, v_cert, v_cert, p_result ->> 'budget_label', nullif(p_answers ->> 'region', ''), v_age, v_intake,
            v_heard, v_for)
    returning id, link_code into v_lead_id, v_code;
  end if;

  return jsonb_build_object('status', 'ok', 'phone', v_phone, 'link_code', v_code);
end;
$$;

-- 5. Registry: the app reports a link it was opened with -----------------------------
insert into public.app_event_types (event, family, description_uz, props, status, added_in) values
  ('link_open', 'account', 'Havola bilan ochdi (operator havolasi)', '{via,result}', 'active', '1.1.3')
on conflict (event) do update
   set family = excluded.family, description_uz = excluded.description_uz,
       props = excluded.props, status = excluded.status;
