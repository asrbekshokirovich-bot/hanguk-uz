-- Hanguk Ish shares this project's sign-in (P48, 2026-11-11).
--
-- Hanguk Ish (hanguk_ish/, its own schema `ish`) signs its workers and
-- employers up here by phone, from its two apps, with
-- user_metadata.app = 'hanguk_ish'. Their profile is ish.profiles, made by
-- ish.handle_new_user; a hanguk.uz profile row (public.profiles) is not for
-- them, so this trigger function now skips them.
--
-- Everything else is production's definition as it was on 2026-11-11 (read
-- with pg_get_functiondef), unchanged.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
      BEGIN
        -- Hanguk Ish's people: their profile is ish.profiles.
        IF COALESCE(NEW.raw_user_meta_data->>'app', '') = 'hanguk_ish' THEN
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
