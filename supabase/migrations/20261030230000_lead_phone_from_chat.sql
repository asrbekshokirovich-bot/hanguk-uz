-- A number the person typed in the chat did not reach the lead (Asrbek,
-- 2026-10-28). fn_extract_phone only took a number written with +998 or a
-- message that was nothing but a 9-digit number starting with 9, so these
-- stayed on the chat and the lead showed no phone:
--   "Nomer 99 045 07 51"
--   "Ismi Dilshoda Tel fon numirim. 935724543"
--   "93 303-07-14 mana shu raqam"
--   "885590206"                       (88, 33, 50, 77, 20 ... codes)
--   "Phone number: 502208314"         (Instagram lead form)
-- Staff then typed the person in again as a second lead, and the chat lead
-- stayed without a number (57 such pairs on 2026-10-28).
--
-- Now: links are removed first (an image URL is full of digits), separators
-- between digits are dropped, and the first Uzbek mobile number anywhere in
-- the text is taken — optional +998/998, then an operator code
-- (20, 33, 50, 55, 61–69, 70–79, 88, 90–99) and 7 digits, not part of a
-- longer number. Korean numbers as before.
--
-- extract_uz_phone (link_chat_identities_by_phone, hourly) uses the same rule.
--
-- The existing leads were filled in once by hand on 2026-10-28 with this rule
-- (68 leads: 29 from their own chat, 39 from the person's other lead); that
-- is data, not part of this migration.

create or replace function public.fn_extract_phone(p_text text)
returns text
language plpgsql
immutable
as $function$
declare
  v_text  text;
  v_clean text;
  v_match text;
begin
  if p_text is null or trim(p_text) = '' then
    return null;
  end if;

  v_text  := regexp_replace(p_text, 'https?://\S+', ' ', 'gi');
  v_clean := regexp_replace(v_text, '(?<=[0-9+])[\s\-\.\(\)]+(?=[0-9(])', '', 'g');

  v_match := (regexp_match(v_clean,
    '(?<![0-9])(?:\+?998)?((?:20|33|50|55|6[1-9]|7[0-9]|88|9[0-9])[0-9]{7})(?![0-9])'))[1];
  if v_match is not null then
    return '+998' || v_match;
  end if;

  v_match := (regexp_match(v_clean, '(?<![0-9])\+?82(10[0-9]{8})(?![0-9])'))[1];
  if v_match is not null then
    return '+82' || v_match;
  end if;

  v_match := (regexp_match(v_clean, '(?<![0-9])(010[0-9]{8})(?![0-9])'))[1];
  if v_match is not null then
    return '+82' || substring(v_match from 2);
  end if;

  return null;
end;
$function$;

-- The 9 local digits of the Uzbek number fn_extract_phone finds.
create or replace function public.extract_uz_phone(txt text)
returns text
language sql
immutable
as $$
  select case when p like '+998%' then substring(p from 5) end
    from (select public.fn_extract_phone(txt) as p) s
$$;
