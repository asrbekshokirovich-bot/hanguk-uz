-- Seven documents carry a file type that is not one: 'application/jpg' (3),
-- 'application/JPG' (2), 'application/PDF' (1) and '' for a .heic (1). The
-- app built the type from the file's extension as it was typed (fixed in
-- #756); the student's page decides «is this a picture» by `image/…` and
-- showed these photos as files to download.
--
-- Only the type is corrected, from the file's own extension. Nothing else on
-- the row changes (the only trigger that fires on this column sets updated_at).

update public.documents
   set file_type = 'image/jpeg'
 where file_type in ('application/jpg', 'application/JPG', 'application/jpeg', 'application/JPEG')
   and lower(file_path) ~ '\.(jpg|jpeg)$';

update public.documents
   set file_type = 'application/pdf'
 where file_type = 'application/PDF'
   and lower(file_path) ~ '\.pdf$';

update public.documents
   set file_type = 'image/heic'
 where coalesce(file_type, '') = ''
   and lower(file_path) ~ '\.heic$';
