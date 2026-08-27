-- One-time batch reject: mark all currently open review_queue items as rejected.
-- Requested by staff — all 22 pending universities have incomplete data.

UPDATE public.review_queue
SET status = 'rejected',
    decided_at = now(),
    reviewer_notes = 'batch_reject: incomplete data'
WHERE status IN ('open', 'in_review');
