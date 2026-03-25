-- Drop the foreign key constraint on profiles.user_id that references auth.users
-- This allows student profiles to be created with a placeholder UUID before they have an auth account

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;