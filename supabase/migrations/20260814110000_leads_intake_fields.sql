-- Lead intake fields.
--
-- The intake screen asks four things the leads table had nowhere to put:
--
--   age             The stated age. `birth_date` is the richer field, but an
--                   operator on a call is told "18", not a date of birth, and
--                   deriving one from the other loses the distinction between
--                   "not asked" and "asked, not given".
--   cert_level      The language certificate *level* ("TOPIK 4", "IELTS 6.0").
--                   `exam_type` already holds the family (TOPIK | IELTS | none)
--                   and stays as-is; this records which band was achieved.
--   contact_channel How the lead reached us (Instagram, Telegram, phone, …),
--                   which is not the same question as `how_heard` — someone can
--                   find us on YouTube and then write on Telegram. `source` is
--                   left to the system-level provenance it already encodes.
--   source_note     The free-text clarification the intake form asks for when
--                   "how did you find us" is a referral, an event, or "other".
--
-- Additive only: no existing column is altered or dropped, and every new column
-- is nullable, so rows written before this migration stay valid.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS age             integer,
  ADD COLUMN IF NOT EXISTS cert_level      text,
  ADD COLUMN IF NOT EXISTS contact_channel text,
  ADD COLUMN IF NOT EXISTS source_note     text;

-- The intake form accepts 15–45; the constraint is deliberately wider so that a
-- back-office correction or an import is never blocked by the form's range.
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_age_range;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_age_range CHECK (age IS NULL OR (age >= 10 AND age <= 99));

COMMENT ON COLUMN public.leads.age IS 'Stated age at intake. Nullable: absent means not asked.';
COMMENT ON COLUMN public.leads.cert_level IS 'Language certificate level, e.g. "TOPIK 4", "IELTS 6.0", "Yo''q".';
COMMENT ON COLUMN public.leads.contact_channel IS 'Channel the lead contacted us through, e.g. "Instagram", "Telegram".';
COMMENT ON COLUMN public.leads.source_note IS 'Free-text clarification for how_heard (referral name, event name, other).';
