-- Lidlar arxivi (Asrbek, 2026-11-14: lidlar ko'payib ketdi — arxiv bo'limi;
-- faqat Lidlar sahifasidan yo'qoladi; operator, admin va owner o'tkazadi;
-- arxivdan qaytarsa bo'ladi; bittalab yoki belgilab ko'pini birdan).
alter table public.leads
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

comment on column public.leads.archived_at is
  'Moved to the Lidlar archive (CRM). Null = in the working list. Only hides the lead on the Lidlar page.';

create index if not exists leads_archived_at_idx on public.leads (archived_at) where archived_at is not null;

-- p_archived = true → arxivga, false → arxivdan qaytarish. Qaytaradi: nechta qator o'zgardi.
create or replace function public.set_leads_archived(p_ids uuid[], p_archived boolean)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n integer;
begin
  if not (public.has_role(auth.uid(), 'owner'::public.app_role)
       or public.has_role(auth.uid(), 'admin'::public.app_role)
       or public.has_role(auth.uid(), 'call_operator'::public.app_role)) then
    raise exception 'Lidni arxivga o''tkazishga ruxsat yo''q' using errcode = '42501';
  end if;

  update public.leads
     set archived_at = case when p_archived then now() else null end,
         archived_by = case when p_archived then auth.uid() else null end
   where id = any(p_ids)
     and (archived_at is null) = p_archived;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.set_leads_archived(uuid[], boolean) from public, anon;
grant execute on function public.set_leads_archived(uuid[], boolean) to authenticated;
