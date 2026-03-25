-- Add payment_mode column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'one_time' CHECK (payment_mode IN ('one_time', 'installment'));