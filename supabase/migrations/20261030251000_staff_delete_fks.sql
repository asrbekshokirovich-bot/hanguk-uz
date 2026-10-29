-- Xodim akkauntini o'chirish (delete-staff) bloklanmasligi uchun.
-- Bu FK'lar ON DELETE NO ACTION edi: xodim hujjat tekshirgan, xarajat kiritgan,
-- yo'riqnoma yuklagan va h.k. bo'lsa auth.users o'chmasdi (Diyora, Odina, Xushnud).
-- Tarix saqlanadi, faqat muallif ustuni NULL bo'ladi.
-- investor_threads.staff_user_id ni delete-staff funksiyasi o'chirayotgan owner'ga o'tkazadi.

alter table public.review_decisions alter column reviewer_id drop not null;
alter table public.student_university_priority_comments alter column created_by drop not null;
-- investorga yozilgan xodim xabari xodim o'chganda yo'qolmasin
alter table public.investor_messages alter column sender_user_id drop not null;

do $$
declare r record;
begin
  for r in select * from (values
    ('documents','reviewed_by','documents_reviewed_by_fkey','auth.users(id)','set null'),
    ('operational_fund_settings','updated_by','operational_fund_settings_updated_by_fkey','auth.users(id)','set null'),
    ('distribution_transfers','created_by','distribution_transfers_created_by_fkey','auth.users(id)','set null'),
    ('expenses','created_by','expenses_created_by_fkey','auth.users(id)','set null'),
    ('student_university_priority_comments','created_by','student_university_priority_comments_created_by_fkey','auth.users(id)','set null'),
    ('review_queue','assigned_to','review_queue_assigned_to_fkey','auth.users(id)','set null'),
    ('translations','reviewed_by','translations_reviewed_by_fkey','auth.users(id)','set null'),
    ('review_decisions','reviewer_id','review_decisions_reviewer_id_fkey','auth.users(id)','set null'),
    ('proposed_sources','reviewed_by','proposed_sources_reviewed_by_fkey','auth.users(id)','set null'),
    ('planned_transactions','created_by','planned_transactions_created_by_fkey','auth.users(id)','set null'),
    ('surveys','created_by','surveys_created_by_fkey','auth.users(id)','set null'),
    ('survey_responses','user_id','survey_responses_user_id_fkey','auth.users(id)','cascade'),
    ('university_guidelines','yuklagan','university_guidelines_yuklagan_fkey','auth.users(id)','set null'),
    ('application_fee_payments','created_by','application_fee_payments_created_by_fkey','public.profiles(user_id)','set null'),
    ('application_fee_receipts','created_by','application_fee_receipts_created_by_fkey','public.profiles(user_id)','set null'),
    -- avval CASCADE edi: xodim o'chsa u yuklagan universitet hujjatlari / investorga xabarlari ham o'chardi
    ('investor_messages','sender_user_id','investor_messages_sender_user_id_fkey','auth.users(id)','set null')
  ) as t(tbl,col,con,ref,act)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.con);
    execute format('alter table public.%I add constraint %I foreign key (%I) references %s on delete %s',
                   r.tbl, r.con, r.col, r.ref, r.act);
  end loop;
end $$;

-- university_documents FK avval NOT VALID + ON UPDATE CASCADE edi — shunday qoladi, faqat ON DELETE o'zgaradi.
alter table public.university_documents drop constraint if exists university_documents_uploaded_by_fkey;
alter table public.university_documents add constraint university_documents_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles(user_id) on update cascade on delete set null not valid;

-- delete-staff funksiyasi chaqiradi (service_role): xodimga biriktirilgan yozuvlarni
-- bitta tranzaksiyada ajratadi. Investor suhbati o'chirayotgan owner'ga o'tadi;
-- owner'da shu investor bilan suhbat bo'lsa, xabarlar o'sha suhbatga qo'shiladi.
create or replace function public.prepare_staff_deletion(p_target uuid, p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  v_existing uuid;
begin
  update public.tasks         set assigned_to   = null where assigned_to   = p_target;
  update public.calls         set staff_id      = null where staff_id      = p_target;
  update public.messages      set assigned_to   = null where assigned_to   = p_target;
  update public.messages      set replied_by    = null where replied_by    = p_target;
  update public.staff_bonuses set staff_user_id = null where staff_user_id = p_target;

  for t in select id, investor_id from public.investor_threads where staff_user_id = p_target loop
    select id into v_existing from public.investor_threads
     where investor_id = t.investor_id and staff_user_id = p_owner;
    if v_existing is null then
      update public.investor_threads set staff_user_id = p_owner where id = t.id;
    else
      update public.investor_messages set thread_id = v_existing where thread_id = t.id;
      delete from public.investor_threads where id = t.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.prepare_staff_deletion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_staff_deletion(uuid, uuid) to service_role;
