-- Who a notification can be sent to, for the CRM's recipient picker.
--
-- Survey notifications used to go to every device with a push token; the
-- owner asked (2026-09-24) to tick the people instead. The CRM needs the list
-- of students who can actually receive one — an app installed and a token
-- enabled — but user_push_tokens is readable only by its owner, and should
-- stay that way: tokens are credentials for a device. This returns people,
-- never tokens, and only to the roles send-push-notification already accepts.

create or replace function public.push_recipients()
returns table (user_id uuid, full_name text, phone text, devices integer, last_seen_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select t.user_id,
         p.full_name,
         p.phone,
         count(*)::integer as devices,
         max(t.last_seen_at) as last_seen_at
    from public.user_push_tokens t
    left join public.profiles p on p.user_id = t.user_id
   where t.enabled
     and exists (
       select 1 from public.user_roles r
        where r.user_id = auth.uid()
          and r.role::text in ('owner', 'admin', 'document_handler')
     )
   group by t.user_id, p.full_name, p.phone
   order by p.full_name nulls last;
$$;

revoke all on function public.push_recipients() from public, anon;
grant execute on function public.push_recipients() to authenticated;
