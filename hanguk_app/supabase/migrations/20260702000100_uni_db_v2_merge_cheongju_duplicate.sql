-- Phase 0.2 of the fix plan: merge the legacy Cheongju alias (chongju.ac.kr,
-- Wade-Giles romanization) into the canonical Cheongju University (cju.ac.kr).
-- The alias owns only 1 admission_cycle + 1 guideline_document (verified) and its
-- cycle does not collide with cju's, so we repoint those and delete the alias.
-- Domain-keyed + idempotent: on a DB without the alias, every statement no-ops.

update public.admission_cycles
   set institution_id = (select id from public.institutions where primary_domain = 'cju.ac.kr')
 where institution_id = (select id from public.institutions where primary_domain = 'chongju.ac.kr');

update public.guideline_documents
   set institution_id = (select id from public.institutions where primary_domain = 'cju.ac.kr')
 where institution_id = (select id from public.institutions where primary_domain = 'chongju.ac.kr');

delete from public.institutions where primary_domain = 'chongju.ac.kr';
