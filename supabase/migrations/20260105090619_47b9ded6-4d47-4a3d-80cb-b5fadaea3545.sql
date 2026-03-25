-- Backfill missing profiles for existing staff/admin users
-- Some legacy staff accounts have roles but no profile row (e.g., when no auth trigger exists).

INSERT INTO public.profiles (user_id, full_name, username, preferred_language)
SELECT DISTINCT
  ur.user_id,
  NULL::text AS full_name,
  NULL::text AS username,
  'uz'::text AS preferred_language
FROM public.user_roles ur
LEFT JOIN public.profiles p
  ON p.user_id = ur.user_id
WHERE p.user_id IS NULL;