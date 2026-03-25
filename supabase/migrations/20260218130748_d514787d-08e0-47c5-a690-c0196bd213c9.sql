-- Bug #6 Fix: Add unique partial index to prevent duplicate document slots per student
-- This enforces one active document row per (student_id, doc_type_id) slot.
-- We use a functional index on the bracketed prefix [docTypeId] in the name column.
-- Since the name format is "[docTypeId] filename.ext", we extract the tag.

-- First, add a generated column to extract the doc_type_id tag from the name
-- We handle it via a unique index on a function that extracts the bracket prefix.

-- Create a function that extracts the document type tag from the name
CREATE OR REPLACE FUNCTION public.extract_doc_type_tag(doc_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN doc_name ~ '^\[([^\]]+)\]' 
    THEN (regexp_match(doc_name, '^\[([^\]]+)\]'))[1]
    ELSE NULL
  END
$$;

-- Add unique index: only one row per (student_id, doc_type_tag) when tag is not NULL
-- This prevents duplicate slot uploads silently accumulating in the DB
CREATE UNIQUE INDEX IF NOT EXISTS documents_student_doc_type_unique
ON public.documents (student_id, public.extract_doc_type_tag(name))
WHERE public.extract_doc_type_tag(name) IS NOT NULL;

-- Note: existing duplicate rows (if any) must be cleaned up before this index takes effect.
-- Since documents table currently has 0 rows, this is safe to apply immediately.