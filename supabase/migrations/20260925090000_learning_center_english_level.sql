-- Learning center portal: ask for the student's English (IELTS) level too.
--
-- The owner asked (2026-09-25) for "Ingliz tili" next to "Koreys tili" in the
-- partner center's "O'quvchi qo'shish" form, asking for the IELTS band. It
-- travels the same way the Korean level already does: stored on the center's
-- row, copied onto the lead fn_learning_center_student_to_lead creates, and
-- shown back to the center through v_learning_center_students.
--
-- leads.english_level already exists (the CRM lead card edits it as free
-- text, e.g. "IELTS 6.5"), so only the center side needs a column.

alter table public.learning_center_students
  add column if not exists english_level text;

create or replace function public.fn_learning_center_student_to_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_center  public.learning_centers%rowtype;
  v_digits  text := right(regexp_replace(new.phone, '\D', '', 'g'), 9);
  v_lead_id uuid;
begin
  select * into v_center from public.learning_centers where id = new.center_id;
  if not found then
    raise exception 'Unknown learning center %', new.center_id;
  end if;

  new.full_name := trim(new.full_name);
  new.phone := coalesce(public.normalize_phone(new.phone), trim(new.phone));
  new.lead_id := null;
  new.already_lead := false;

  select l.id into v_lead_id
    from public.leads l
   where coalesce(l.phone, '') <> ''
     and right(regexp_replace(l.phone, '\D', '', 'g'), 9) = v_digits
   order by l.created_at
   limit 1;

  if v_lead_id is not null then
    new.lead_id := v_lead_id;
    new.already_lead := true;
    return new;
  end if;

  insert into public.leads (
    full_name, phone, city, age, korean_level, english_level, notes,
    source, source_id, source_note, how_heard,
    learning_center_id, assigned_to, created_by
  ) values (
    new.full_name, new.phone, nullif(trim(new.city), ''), new.age,
    nullif(trim(new.korean_level), ''), nullif(trim(new.english_level), ''),
    nullif(trim(new.notes), ''),
    'learning_center', new.id::text, v_center.name, 'O‘quv markaz',
    v_center.id, v_center.assigned_to, new.created_by
  )
  returning id into v_lead_id;

  new.lead_id := v_lead_id;
  return new;
end;
$function$;

-- New column appended at the end, so the view can be replaced in place.
create or replace view public.v_learning_center_students as
 select s.id,
    s.center_id,
    s.full_name,
    s.phone,
    s.city,
    s.age,
    s.korean_level,
    s.notes,
    s.already_lead,
    s.created_at,
        case
            when s.already_lead then null::text
            else l.status
        end as lead_status,
    s.english_level
   from (learning_center_students s
     left join leads l on ((l.id = s.lead_id)))
  where ((s.center_id = my_learning_center_id()) or can_manage_learning_centers());
