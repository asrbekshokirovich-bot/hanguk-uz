-- Hanguk Ish — row level security (P1, 2026-11-10).
--
-- Rule of thumb: people read and write their own rows; a business reads what
-- concerns its own shifts. Everything that changes the state of a shift or an
-- application goes through the security-definer functions in
-- 20261110120200_ish_rpc.sql, which check the rules (slots, overlap, QR time
-- window) under a row lock — never through direct table writes.

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer, so policies can call them without
-- recursing into business_members' own policies).
-- ---------------------------------------------------------------------------

create function ish.is_business_member(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = ish
as $$
  select exists (
    select 1 from ish.business_members
    where business_id = p_business and user_id = auth.uid()
  )
$$;

create function ish.is_shift_member(p_shift uuid)
returns boolean
language sql
stable
security definer
set search_path = ish
as $$
  select exists (
    select 1
    from ish.shifts s
    join ish.business_members m on m.business_id = s.business_id
    where s.id = p_shift and m.user_id = auth.uid()
  )
$$;

-- True when [p_worker] has applied to a shift of a business the caller
-- belongs to (so the business may see that worker's profile).
create function ish.is_my_applicant(p_worker uuid)
returns boolean
language sql
stable
security definer
set search_path = ish
as $$
  select exists (
    select 1
    from ish.applications a
    join ish.shifts s on s.id = a.shift_id
    join ish.business_members m on m.business_id = s.business_id
    where a.worker_id = p_worker and m.user_id = auth.uid()
  ) or exists (
    select 1
    from ish.favorites f
    join ish.business_members m on m.business_id = f.business_id
    where f.worker_id = p_worker and m.user_id = auth.uid()
  )
$$;

-- True when the caller is the worker or a member of the business of
-- [p_application] — the two sides of its chat.
create function ish.is_application_party(p_application uuid)
returns boolean
language sql
stable
security definer
set search_path = ish
as $$
  select exists (
    select 1
    from ish.applications a
    join ish.shifts s on s.id = a.shift_id
    where a.id = p_application
      and (a.worker_id = auth.uid() or exists (
        select 1 from ish.business_members m
        where m.business_id = s.business_id and m.user_id = auth.uid()
      ))
  )
$$;

revoke execute on function ish.is_business_member(uuid) from public, anon;
revoke execute on function ish.is_shift_member(uuid) from public, anon;
revoke execute on function ish.is_my_applicant(uuid) from public, anon;
revoke execute on function ish.is_application_party(uuid) from public, anon;
grant execute on function ish.is_business_member(uuid) to authenticated;
grant execute on function ish.is_shift_member(uuid) to authenticated;
grant execute on function ish.is_my_applicant(uuid) to authenticated;
grant execute on function ish.is_application_party(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table ish.minimum_wages enable row level security;
alter table ish.profiles enable row level security;
alter table ish.worker_profiles enable row level security;
alter table ish.businesses enable row level security;
alter table ish.business_members enable row level security;
alter table ish.shift_templates enable row level security;
alter table ish.shifts enable row level security;
alter table ish.shift_secrets enable row level security;
alter table ish.applications enable row level security;
alter table ish.ratings enable row level security;
alter table ish.favorites enable row level security;
alter table ish.messages enable row level security;
alter table ish.notifications enable row level security;
alter table ish.push_tokens enable row level security;
alter table ish.reports enable row level security;

-- ---------------------------------------------------------------------------
-- Privileges. Table-level grants cover every column, so they are revoked and
-- writes are granted column by column: whatever is not listed here (status,
-- reliability, translations, owner columns …) changes only inside the
-- security-definer functions or with the service role.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema ish from anon, authenticated;
grant select on all tables in schema ish to authenticated;
revoke select on ish.shift_secrets from authenticated;

grant update (first_name, last_name, avatar_path, language)
  on ish.profiles to authenticated;

grant insert (languages, topik, university, district, lat, lng, availability, visa, onboarded_at),
      update (languages, topik, university, district, lat, lng, availability, visa, onboarded_at)
  on ish.worker_profiles to authenticated;

grant update (name, category, address, district, lat, lng)
  on ish.businesses to authenticated;

grant insert, update, delete on ish.shift_templates to authenticated;

grant insert (business_id, template_id, title, duties, dress, address, lat, lng,
              starts_at, ends_at, hourly_wage, slots, auto_confirm)
  on ish.shifts to authenticated;
grant update (title, duties, dress, address, lat, lng,
              starts_at, ends_at, hourly_wage, slots, auto_confirm)
  on ish.shifts to authenticated;

grant insert (application_id, body, lang), update (read_at)
  on ish.messages to authenticated;

grant update (read_at) on ish.notifications to authenticated;

grant delete on ish.push_tokens to authenticated;

grant insert (application_id, business_id, reason, body)
  on ish.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

create policy minimum_wages_read on ish.minimum_wages
  for select to authenticated using (true);

-- profiles: your own; a business sees its applicants and favourites; a worker
-- sees the people of the businesses whose shifts they applied to (chat names).
create policy profiles_read on ish.profiles
  for select to authenticated using (
    id = auth.uid()
    or ish.is_my_applicant(id)
    or exists (
      select 1
      from ish.applications a
      join ish.shifts s on s.id = a.shift_id
      join ish.business_members m on m.business_id = s.business_id
      where a.worker_id = auth.uid() and m.user_id = profiles.id
    )
  );
create policy profiles_update_own on ish.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy worker_profiles_read on ish.worker_profiles
  for select to authenticated using (user_id = auth.uid() or ish.is_my_applicant(user_id));
create policy worker_profiles_insert_own on ish.worker_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy worker_profiles_update_own on ish.worker_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- businesses: verified ones are public to signed-in users; members see their
-- own in any state. Created by the register function (service role) only.
create policy businesses_read on ish.businesses
  for select to authenticated using (status = 'verified' or ish.is_business_member(id));
create policy businesses_update_member on ish.businesses
  for update to authenticated
  using (ish.is_business_member(id)) with check (ish.is_business_member(id));

create policy business_members_read on ish.business_members
  for select to authenticated using (user_id = auth.uid() or ish.is_business_member(business_id));

create policy shift_templates_member on ish.shift_templates
  for all to authenticated
  using (ish.is_business_member(business_id))
  with check (ish.is_business_member(business_id));

-- shifts: open shifts of verified businesses for everyone signed in; members
-- see all of theirs; a worker keeps seeing shifts they applied to.
create policy shifts_read on ish.shifts
  for select to authenticated using (
    (status = 'open' and exists (
      select 1 from ish.businesses b where b.id = business_id and b.status = 'verified'))
    or ish.is_business_member(business_id)
    or exists (select 1 from ish.applications a where a.shift_id = id and a.worker_id = auth.uid())
  );
create policy shifts_insert_member on ish.shifts
  for insert to authenticated with check (
    ish.is_business_member(business_id)
    and exists (select 1 from ish.businesses b where b.id = business_id and b.status = 'verified')
  );
create policy shifts_update_member on ish.shifts
  for update to authenticated
  using (ish.is_business_member(business_id))
  with check (ish.is_business_member(business_id));

-- shift_secrets: no policy and no grant — the QR secret is read only by shift_qr().

create policy applications_read on ish.applications
  for select to authenticated using (worker_id = auth.uid() or ish.is_shift_member(shift_id));

create policy ratings_read on ish.ratings
  for select to authenticated using (
    rater_id = auth.uid() or ish.is_application_party(application_id)
  );

create policy favorites_member on ish.favorites
  for select to authenticated using (ish.is_business_member(business_id));

create policy messages_read on ish.messages
  for select to authenticated using (ish.is_application_party(application_id));
create policy messages_send on ish.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and ish.is_application_party(application_id)
  );
create policy messages_mark_read on ish.messages
  for update to authenticated
  using (ish.is_application_party(application_id) and sender_id <> auth.uid())
  with check (ish.is_application_party(application_id));

create policy notifications_own on ish.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on ish.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tokens are registered through register_push_token(); a user may read and
-- delete their own.
create policy push_tokens_own on ish.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy push_tokens_delete_own on ish.push_tokens
  for delete to authenticated using (user_id = auth.uid());

create policy reports_own on ish.reports
  for select to authenticated using (reporter_id = auth.uid());
create policy reports_insert_own on ish.reports
  for insert to authenticated with check (reporter_id = auth.uid());
