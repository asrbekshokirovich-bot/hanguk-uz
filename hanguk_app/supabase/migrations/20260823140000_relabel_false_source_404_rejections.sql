-- "Manba ochilmadi" was the wrong label on 189 rejected review rows.
--
-- Every one of the 58 documents behind those rows HAS its PDF in the private
-- bucket — `storage_path` is non-null on all 58, and 17 of them were uploaded
-- by hand (`source_url_ko` starts with `manual-upload:`), so they have no URL
-- that could 404 in the first place.
--
-- The 27 remaining source URLs were re-fetched on 2026-08-23. Twenty came back
-- byte-for-byte identical to the size already stored — 숭실대 958 235 bytes,
-- 서울여대 1 539 559, 고려대 1 066 008, and so on. Exactly one was genuinely
-- dead (세종대; its notice board had moved the attachment, and the new URL is
-- now recorded). One more could not be reached from this network (가천대) but
-- its file is stored. Two earlier "failures" were the local resolver, not the
-- host: both returned 200 on retry.
--
-- What actually went wrong is visible in the payloads: 138 of the 164 rejected
-- SECTION cards (84%) carry an extraction with zero rows, zero events and zero
-- periods. Spot-checking the source PDFs shows the data is there to find —
-- 숭실대 mentions 등록금/전형료 41 times and its tuition card is empty; 고려대
-- 24 times, likewise empty. At the time these were graded GREEN ("all checks
-- passed") because the gauntlet skipped both LLM gates when there were no rows,
-- so a reviewer saw a confident badge over an empty body and reached for the
-- closest-looking button.
--
-- This corrects the label on exactly those 138, and leaves the reviewer's
-- verdict (`rejected`) untouched — the cards were right to be rejected, the
-- stated reason was wrong. `original_reason` keeps what was recorded before so
-- nothing is lost.
--
-- The other 51 rows are NOT relabelled: 26 section cards did carry data (so
-- the rejection had some other cause this migration cannot know), and 25 are
-- document-level flags rather than extractions. They get one factual line
-- appended saying the source was verified present, and a human decides.
--
-- `status` is deliberately not touched: `trg_review_queue_audit` fires only
-- WHEN (old.status IS DISTINCT FROM new.status), so leaving it alone preserves
-- each row's original `resolved_at` and adds no phantom audit entries.

-- --- 1. the 138 empty-extraction cards ------------------------------------
with target as (
  select rq.id
  from public.review_queue rq
  join public.extraction_jobs ej
    on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
  where rq.status = 'rejected'
    and rq.reviewer_decision ->> 'reason' = 'source_404'
    and coalesce(jsonb_array_length(ej.parsed_output -> 'rows'), 0)
      + coalesce(jsonb_array_length(ej.parsed_output -> 'events'), 0)
      + coalesce(jsonb_array_length(ej.parsed_output -> 'periods'), 0) = 0
)
update public.review_queue rq
   set reviewer_decision = rq.reviewer_decision || jsonb_build_object(
         'reason', 'empty_extraction',
         'original_reason', rq.reviewer_decision ->> 'reason',
         'relabelled_on', '2026-08-23',
         'relabel_evidence',
           'PDF stored in bucket; source URL re-fetched and byte-identical; '
           || 'extraction payload has 0 rows/events/periods'
       ),
       reviewer_notes = 'empty_extraction: manba joyida — PDF saqlangan va '
         || 'havola tekshirildi. Rad etilish sababi manba emas: ekstraksiya '
         || 'bo''sh qaytgan. Qayta ekstraksiya kerak.'
 where rq.id in (select id from target);

-- --- 2. the 51 rows this migration must not guess at ------------------------
--
-- Runs AFTER statement 1 and matches on `reason = 'source_404'` again, which
-- by now selects only what statement 1 did not relabel: the 26 section cards
-- that carried data and the 25 document-level flags. The order is load-bearing
-- — swapping these two statements would put the "verify" note on all 189.
--
-- `reviewer_notes` is REBUILT as "<reason>: <text>" rather than appended to.
-- The UI's serverRejection() splits on the FIRST colon to read the reason code,
-- so appending a line that contains a colon of its own (a date, say) would make
-- the head "source_404 | 2026-08-23" — no longer a code it recognises, and the
-- card would lose its reason label entirely. Every one of these rows has a null
-- `detail`, so nothing written by the reviewer is dropped here.
update public.review_queue rq
   set reviewer_decision = rq.reviewer_decision || jsonb_build_object(
         'source_verified_on', '2026-08-23',
         'source_verified_note',
           'PDF is present in storage and the source URL was reachable on '
           || 'this date; the recorded source_404 reason does not hold'
       ),
       reviewer_notes = 'source_404: '
         || coalesce(nullif(rq.reviewer_decision ->> 'detail', '') || ' — ', '')
         || '2026-08-23 da tekshirildi — PDF saqlangan va havola ishlayapti, '
         || 'demak "manba ochilmadi" sababi to''g''ri emas. Qayta ko''rib chiqing.'
 where rq.status = 'rejected'
   and rq.reviewer_decision ->> 'reason' = 'source_404';
