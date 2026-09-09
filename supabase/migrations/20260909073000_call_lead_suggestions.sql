-- What the AI thinks a call says about the lead, held for an operator to confirm.
--
-- Deliberately NOT written straight into `leads`. A model that edits the record
-- directly is unreviewable: once a wrong city or TOPIK level is in the field,
-- nobody can tell whether a person put it there or a transcript guess did. So
-- each field arrives as its own row, with the confidence and the sentence it
-- came from, and only becomes lead data when somebody accepts it.
--
-- The rejected and edited rows are the point as much as the accepted ones: they
-- are the record of where the prompt is wrong, and the only honest way to know
-- whether it is getting better.
create table if not exists public.call_lead_suggestions (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid not null references public.calls(id) on delete cascade,
  lead_id         uuid references public.leads(id) on delete cascade,
  student_id      uuid references public.profiles(user_id) on delete cascade,
  field           text not null,
  suggested_value text,
  confidence      numeric(3,2) check (confidence >= 0 and confidence <= 1),
  evidence        text,
  status          text not null default 'pending'
                  check (status in ('pending', 'accepted', 'rejected', 'edited')),
  corrected_value text,
  decided_by      uuid references public.profiles(user_id) on delete set null,
  decided_at      timestamptz,
  model           text,
  created_at      timestamptz not null default now()
);

create unique index if not exists idx_cls_call_field
  on public.call_lead_suggestions (call_id, field);
create index if not exists idx_cls_pending
  on public.call_lead_suggestions (lead_id) where status = 'pending';

alter table public.call_lead_suggestions enable row level security;

drop policy if exists cls_staff_read on public.call_lead_suggestions;
create policy cls_staff_read on public.call_lead_suggestions
  for select to authenticated
  using (exists (select 1 from public.user_roles r
                 where r.user_id = auth.uid() and r.role in ('owner','admin','call_operator')));

drop policy if exists cls_staff_decide on public.call_lead_suggestions;
create policy cls_staff_decide on public.call_lead_suggestions
  for update to authenticated
  using (exists (select 1 from public.user_roles r
                 where r.user_id = auth.uid() and r.role in ('owner','admin','call_operator')))
  with check (exists (select 1 from public.user_roles r
                 where r.user_id = auth.uid() and r.role in ('owner','admin','call_operator')));
