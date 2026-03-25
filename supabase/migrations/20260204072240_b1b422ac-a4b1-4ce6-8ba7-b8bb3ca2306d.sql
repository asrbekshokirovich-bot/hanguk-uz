-- Add GKS applicant column to profiles table
ALTER TABLE public.profiles
ADD COLUMN is_gks_applicant boolean DEFAULT false;