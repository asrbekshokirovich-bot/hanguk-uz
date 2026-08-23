-- Only the 2027 intake is wanted in the review queue; 2024/2025 guidelines are
-- removed from the database entirely.
--
-- `academic_year` was null on 42 of the 87 documents in the queue, so before
-- any of this the year was read out of each PDF itself and backfilled. The
-- rule is the document's own title — a 2027 guideline quotes 2026 all through
-- its body (last year's figures, application dates that fall in calendar
-- 2026), so counting mentions picked the wrong year on 6 of 8 documents where
-- the DB already had an answer to check against.
--
-- The seven documents deleted here were each opened and confirmed:
--   동덕여자대학교   "2024학년도 신입학 재외국민과 외국인 특별전형 모집요강"
--   동의대학교       "2024학년도 후기 외국인 특별전형 1차 모집요강"
--   청주대학교       "2024학년도 재외국민과 외국인 수시모집 특별전형 모집요강"
--   서강대학교       only 2025학년도 appears — the blob is named
--                    SOGANG_UNIVERSITY_2027.pdf but the file is the 2025
--                    재외국민 guideline; the manual upload was mislabelled.
--   인하대학교 x2    not guidelines at all: "2026학년도 신입학 합격자 등록
--                    유의사항" (a registration notice) and "[책자] 고교학점제
--                    지원 인하 진로설계 워크북" (a careers workbook)
--   한국과학기술원   "KAIST International Student Viewbook" — a brochure
--
-- review_queue has no foreign key to guideline_documents (entity_id is
-- polymorphic), so its rows must be deleted explicitly or they are orphaned.
-- extraction_jobs and embedding_chunks cascade; admission_cycles and
-- pdf_access_log are SET NULL; announcements and superseded_by_id are NO
-- ACTION and would block the delete, so both are cleared first.
--
-- The seven storage blobs were removed in the same operation, after checking
-- that no surviving document references any of the paths — the sha256/ bucket
-- is content-addressed, so two rows can legitimately share one file.

-- 1. Three 인하대 documents point their `superseded_by_id` at the 2025
--    registration notice below — a 2027, a 2026 and a 2028 document all
--    "superseded by" a 2025 notice. The pointer is backwards regardless of
--    this migration; clearing it corrects the record rather than losing it.
update public.guideline_documents
   set superseded_by_id = null
 where superseded_by_id = '225381b2-6aeb-475f-90bb-31d53db3b86e';

-- 2. Announcements attached to the three non-guideline files.
delete from public.announcements
 where guideline_document_id in (
   '225381b2-6aeb-475f-90bb-31d53db3b86e',
   '89016bb8-2ac2-458e-b4a2-cb0a008d52fb',
   'd4635a7b-23b0-41cc-905f-70d46ff62990'
 );

-- 3. Queue rows for the doomed documents — both the per-section cards (via
--    extraction_jobs) and the document-level flags.
delete from public.review_queue rq
 using public.extraction_jobs ej
 where ej.id = rq.entity_id
   and rq.entity_type = 'extraction_jobs'
   and ej.guideline_document_id in (
     '8b1924e9-bfc4-400f-9896-38c4908c7464','30bcc642-5f30-4fc0-bcac-cb1b374b0663',
     'a22e7d48-f40b-452e-ab46-92a9a899de70','225381b2-6aeb-475f-90bb-31d53db3b86e',
     '89016bb8-2ac2-458e-b4a2-cb0a008d52fb','b58d89bb-771b-4d22-92d6-8ec8b71176fd',
     'd4635a7b-23b0-41cc-905f-70d46ff62990');

delete from public.review_queue
 where entity_type = 'guideline_documents'
   and entity_id in (
     '8b1924e9-bfc4-400f-9896-38c4908c7464','30bcc642-5f30-4fc0-bcac-cb1b374b0663',
     'a22e7d48-f40b-452e-ab46-92a9a899de70','225381b2-6aeb-475f-90bb-31d53db3b86e',
     '89016bb8-2ac2-458e-b4a2-cb0a008d52fb','b58d89bb-771b-4d22-92d6-8ec8b71176fd',
     'd4635a7b-23b0-41cc-905f-70d46ff62990');

-- 4. The documents themselves.
delete from public.guideline_documents
 where id in (
   '8b1924e9-bfc4-400f-9896-38c4908c7464','30bcc642-5f30-4fc0-bcac-cb1b374b0663',
   'a22e7d48-f40b-452e-ab46-92a9a899de70','225381b2-6aeb-475f-90bb-31d53db3b86e',
   '89016bb8-2ac2-458e-b4a2-cb0a008d52fb','b58d89bb-771b-4d22-92d6-8ec8b71176fd',
   'd4635a7b-23b0-41cc-905f-70d46ff62990');

-- 5. Everything left in the queue that is not the 2027 intake leaves the
--    queue but stays in the database. `superseded` is the right status: these
--    rows were not judged by a reviewer, they are simply not the cycle being
--    worked on. A null year is included — an unclassified document is not
--    evidence of a 2027 one, and it can be brought back by setting its year.
update public.review_queue rq
   set status = 'superseded',
       resolved_at = now(),
       needs_attention = false
  from public.extraction_jobs ej
  join public.guideline_documents d on d.id = ej.guideline_document_id
 where ej.id = rq.entity_id
   and rq.entity_type = 'extraction_jobs'
   and rq.status in ('open','in_review','rejected')
   and (d.academic_year is distinct from 2027);

update public.review_queue rq
   set status = 'superseded',
       resolved_at = now(),
       needs_attention = false
  from public.guideline_documents d
 where d.id = rq.entity_id
   and rq.entity_type = 'guideline_documents'
   and rq.status in ('open','in_review','rejected')
   and (d.academic_year is distinct from 2027);
