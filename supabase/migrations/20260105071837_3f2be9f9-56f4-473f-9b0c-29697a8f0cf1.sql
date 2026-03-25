-- Update the handle_new_user function to skip profile creation for student accounts
-- Students have their profiles created manually before their auth account is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip profile creation for student accounts (they start with 'student-' email)
  -- Students have their profiles pre-created with magic_code before auth account
  IF NEW.email LIKE 'student-%@hanguk.local' THEN
    -- Update the existing profile to link to this new auth user
    UPDATE public.profiles 
    SET user_id = NEW.id
    WHERE user_id = (NEW.raw_user_meta_data->>'original_user_id')::uuid;
    RETURN NEW;
  END IF;
  
  -- For staff accounts, create a new profile
  INSERT INTO public.profiles (user_id, full_name, preferred_language)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'uz'));
  
  RETURN NEW;
END;
$$;