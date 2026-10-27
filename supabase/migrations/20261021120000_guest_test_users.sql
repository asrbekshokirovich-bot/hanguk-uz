-- Guests taking a university's tests get a user of their own
-- (guest-test-session): no profile for them, so they never appear among the
-- students.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
      BEGIN
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
