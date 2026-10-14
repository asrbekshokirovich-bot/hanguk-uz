-- Only an admin (owner/admin role) may approve a document.
--
-- The CRM now hides the approve controls from everyone else, but the table
-- policies still let a student insert their own rows with any status, and let
-- document_handler/call_operator update rows. Without this, a student could
-- write `status = 'approved'` straight through the API and skip review.
--
-- Requests without a user (service role, edge functions) are left alone.

create or replace function public.enforce_admin_document_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and auth.uid() is not null
     and not (
       has_role(auth.uid(), 'owner'::app_role) or
       has_role(auth.uid(), 'admin'::app_role)
     )
  then
    raise exception 'Only an admin can approve documents'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_admin_only_approval on public.documents;
create trigger documents_admin_only_approval
  before insert or update of status on public.documents
  for each row
  execute function public.enforce_admin_document_approval();
