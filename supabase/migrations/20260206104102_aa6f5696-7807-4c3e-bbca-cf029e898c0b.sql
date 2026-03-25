
-- Restore leads that were never actually contacted by staff
-- Only leads whose notes are all without a real contact_type (phone_call, telegram, etc.)
UPDATE leads 
SET status = 'new', last_contacted_at = NULL
WHERE status = 'contacted'
  AND id NOT IN (
    SELECT DISTINCT lead_id FROM lead_notes 
    WHERE contact_type IN ('phone_call', 'telegram', 'instagram', 'whatsapp', 'in_person', 'email')
  );
