-- Universitet tanlash: ilovaga hali kirmagan talabaga ham universitet tanlansin.
--
-- CRM'da yaratilgan talabaning profiles.user_id — tasodifiy uuid
-- (create-student: "no auth account yet"). auth.users qatori talaba ilovaga
-- magic kod bilan birinchi marta kirganda yaratiladi va student-login-v2
-- profiles.user_id ni yangi auth id'ga almashtiradi. Shuning uchun boshqa
-- talaba jadvallari (payments, documents, student_intakes, student_phones,
-- application_fee_payments ...) profiles(user_id) ga ON UPDATE CASCADE bilan
-- bog'langan.
--
-- student_university_choices, student_university_submissions va
-- university_choice_changes esa auth.users(id) ga bog'langan edi — ilovaga
-- kirmagan talabaga universitet tanlab bo'lmasdi (CRM, 2026-11-05):
--   insert or update on table "student_university_choices" violates foreign
--   key constraint "student_university_choices_student_id_fkey"
-- Bahor 2027 da 4 talaba shu holatda edi.
--
-- Endi uchalasi profiles(user_id) ga bog'lanadi: talaba ilovaga kirgunicha
-- ham yoziladi, kirganda student_id o'zi yangi auth id'ga o'tadi.
-- student_stage_notifications o'zgarmaydi — push faqat ilovaga kirganlarga
-- boradi (enqueue_stage_notification auth.users'ni tekshiradi).

alter table public.student_university_choices
  drop constraint if exists student_university_choices_student_id_fkey,
  add constraint student_university_choices_student_id_fkey
    foreign key (student_id) references public.profiles (user_id)
    on update cascade on delete cascade;

alter table public.student_university_submissions
  drop constraint if exists student_university_submissions_student_id_fkey,
  add constraint student_university_submissions_student_id_fkey
    foreign key (student_id) references public.profiles (user_id)
    on update cascade on delete cascade;

alter table public.university_choice_changes
  drop constraint if exists university_choice_changes_student_id_fkey,
  add constraint university_choice_changes_student_id_fkey
    foreign key (student_id) references public.profiles (user_id)
    on update cascade on delete cascade;
