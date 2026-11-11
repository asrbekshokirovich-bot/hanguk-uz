-- Hanguk Ish signs its people in without SMS (P49, 2026-11-11).
--
-- Its two apps now start an anonymous account on the phone
-- (auth.users.is_anonymous; «Allow anonymous sign-ins» in the dashboard).
-- hanguk.uz has no anonymous accounts of its own — its staff, students and
-- guests sign in with a password — so no anonymous account gets a hanguk.uz
-- profile row (public.profiles), whichever client made it. Hanguk Ish's own
-- also carry user_metadata.app = 'hanguk_ish' (skipped since P48) and get
-- their profile from ish.handle_new_user.
--
-- Everything else is 20261111150000_hanguk_ish_skip_main_profile.sql, which
-- is production's definition of 2026-11-11 with the P48 line, unchanged.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
      BEGIN
        -- Hanguk Ish's people (P48) and every anonymous account (P49):
        -- hanguk.uz makes no anonymous accounts of its own.
        IF COALESCE(NEW.raw_user_meta_data->>'app', '') = 'hanguk_ish'
           OR COALESCE(NEW.is_anonymous, false) THEN
          RETURN NEW;
        END IF;

        IF NEW.email LIKE 'guest-%@hanguk.local' THEN
          RETURN NEW;
        END IF;

        IF NEW.email LIKE 'student-%@hanguk.local' THEN
          UPDATE public.profiles 
          SET user_id = NEW.id
          WHERE user_id = (NEW.raw_user_meta_data->>'original_user_id')::uuid;
          RETURN NEW;
        END IF;

        INSERT INTO public.profiles (user_id, full_name, preferred_language)
        VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'uz'))
        ON CONFLICT(user_id) DO NOTHING;

        RETURN NEW;
      END;
      $function$;
