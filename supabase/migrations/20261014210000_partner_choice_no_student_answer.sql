-- The third choice (rank 3) is the partner university staff attach
-- themselves: the student does not answer it, so respond_university_choice()
-- refuses it. Staff confirm it straight away in the CRM.
--
-- Applied to production on 2026-10-14 through the Supabase connector; kept
-- here so the repo matches.

create or replace function public.respond_university_choice(
  p_choice_id uuid,
  p_accept boolean,
  p_reason text default null,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.student_university_choices%rowtype;
begin
  select * into v_row from public.student_university_choices where id = p_choice_id;
  if not found or v_row.student_id is distinct from auth.uid() then
    raise exception 'Choice not found' using errcode = '42501';
  end if;
  if v_row.rank = 3 then
    raise exception 'The partner university needs no answer' using errcode = '42501';
  end if;
  if v_row.status = 'confirmed' then
    raise exception 'Already confirmed by the consultant' using errcode = '42501';
  end if;
  update public.student_university_choices
     set status = case when p_accept then 'accepted' else 'change_requested' end,
         responded_at = now(),
         change_reason = case when p_accept then null else nullif(trim(p_reason), '') end,
         change_note = case when p_accept then null else nullif(trim(p_note), '') end
   where id = p_choice_id;
end;
$$;
