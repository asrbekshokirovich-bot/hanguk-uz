-- Numbers written the old way, with a leading 8 ("Phone number: 8 95 225 36 09",
-- an Instagram lead form on 2026-10-28), were not taken: the 9 digits after
-- the 8 sit right after another digit. The 8 is now accepted in place of +998.
-- Otherwise the same as 20261030230000_lead_phone_from_chat.

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
    '(?<![0-9])(?:\+?998|8)?((?:20|33|50|55|6[1-9]|7[0-9]|88|9[0-9])[0-9]{7})(?![0-9])'))[1];
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
