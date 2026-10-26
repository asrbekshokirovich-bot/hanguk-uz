-- So'rovnoma bildirishnomasini yuborish — nomlangan xodimlar uchun.
--
-- Asrbek (2026-10-26): Omina (call_operator) ham so'rovnoma yubora olsin.
-- Survey push used to be owner / admin / document_handler only, in three
-- places: the CRM bell button, push_recipients() and the
-- send-push-notification edge function. This adds a named list, exactly like
-- application_fee_access: people listed here may SEND a survey notification.
-- They still cannot create, switch off or delete surveys.

create table if not exists public.survey_send_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now()
);

alter table public.survey_send_access enable row level security;

drop policy if exists "survey_send_access_read" on public.survey_send_access;
create policy "survey_send_access_read" on public.survey_send_access
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

drop policy if exists "survey_send_access_manage" on public.survey_send_access;
create policy "survey_send_access_manage" on public.survey_send_access
  for all to authenticated
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  )
  with check (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

create or replace function public.can_send_surveys(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select exists (
           select 1 from public.user_roles r
            where r.user_id = p_uid
              and r.role::text in ('owner', 'admin', 'document_handler')
         )
      or exists (select 1 from public.survey_send_access a where a.user_id = p_uid)
$$;

revoke all on function public.can_send_surveys(uuid) from public, anon;
grant execute on function public.can_send_surveys(uuid) to authenticated, service_role;

-- push_recipients(): same body as prod (pg_get_functiondef, 2026-10-26); only
-- the role check now goes through can_send_surveys().
create or replace function public.push_recipients()
 returns table(user_id uuid, full_name text, phone text, devices integer, last_seen_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select t.user_id,
         p.full_name,
         p.phone,
         count(*)::integer as devices,
         max(t.last_seen_at) as last_seen_at
    from public.user_push_tokens t
    left join public.profiles p on p.user_id = t.user_id
   where t.enabled
     and public.can_send_surveys(auth.uid())
   group by t.user_id, p.full_name, p.phone
   order by p.full_name nulls last;
$function$;
