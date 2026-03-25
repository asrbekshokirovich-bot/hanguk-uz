
-- Step 1: Add institution_type column
ALTER TABLE public.universities 
  ADD COLUMN IF NOT EXISTS institution_type text DEFAULT 'university';

-- Step 2: Remove outdated/merged Korea Polytechnic numbered entries (8 records)
DELETE FROM public.universities 
  WHERE name_en IN (
    'Korea Polytechnic I', 'Korea Polytechnic II', 'Korea Polytechnic III',
    'Korea Polytechnic IV', 'Korea Polytechnic V', 'Korea Polytechnic VI',
    'Korea Polytechnic VII', 'Korea Polytechnics'
  );

-- Step 3: Auto-classify all remaining entries (order matters — most specific first)

-- Military/Police academies
UPDATE public.universities SET institution_type = 'military_police'
  WHERE name_en ILIKE '%Military Academy%' 
     OR name_en ILIKE '%Police University%'
     OR name_en ILIKE '%Naval Academy%' 
     OR name_en ILIKE '%Air Force Academy%';

-- Foreign branch campuses
UPDATE public.universities SET institution_type = 'foreign_branch'
  WHERE name_en IN (
    'George Mason University', 'Ghent University',
    'State University of New York Korea', 'University of Utah Asia Campus'
  );

-- Polytechnic (vocational)
UPDATE public.universities SET institution_type = 'polytechnic'
  WHERE name_en ILIKE '%Polytechnic%' AND institution_type = 'university';

-- Theological seminaries
UPDATE public.universities SET institution_type = 'theological'
  WHERE (name_en ILIKE '%Theological%' OR name_en ILIKE '%Seminary%' OR name_en ILIKE '%Bible%')
    AND institution_type = 'university';

-- Online/Cyber universities
UPDATE public.universities SET institution_type = 'online_only'
  WHERE (name_en ILIKE '%Cyber%' OR name_en ILIKE '%Digital%' AND name_en ILIKE '%Univer%')
    AND institution_type = 'university';

-- Graduate-only schools
UPDATE public.universities SET institution_type = 'graduate_only'
  WHERE (name_en ILIKE '%Graduate School%' OR name_en ILIKE '%Graduate University%')
    AND institution_type = 'university';

-- Junior/Community Colleges (전문대학 pattern)
UPDATE public.universities SET institution_type = 'junior_college'
  WHERE (name_en ILIKE '%College%' AND name_en NOT ILIKE '%University%' AND name_en NOT ILIKE '%Graduate%')
    AND institution_type = 'university';

-- Step 4: Fix website conflict
-- acts.ac.kr belongs to Asia United Theological University
UPDATE public.universities 
  SET website = 'https://acts.ac.kr'
  WHERE name_en = 'Asia United Theological University';

-- Asian University has a different website
UPDATE public.universities 
  SET website = 'https://asianuniversity.ac.kr'
  WHERE name_en = 'Asian University' AND website = 'https://acts.ac.kr';
