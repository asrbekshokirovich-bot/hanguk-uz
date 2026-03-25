-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create system_settings table to track app configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  owner_created BOOLEAN NOT NULL DEFAULT false,
  signup_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read settings"
  ON public.system_settings
  FOR SELECT
  USING (true);

-- Only owners can update settings
CREATE POLICY "Owners can update settings"
  ON public.system_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'owner'));

-- Insert default settings
INSERT INTO public.system_settings (id, owner_created, signup_enabled)
VALUES ('main', false, true)
ON CONFLICT (id) DO NOTHING;

-- Add updated_at trigger
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();