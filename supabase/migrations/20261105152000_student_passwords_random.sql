-- Xavfsizlik (2026-11-05): student-…@hanguk.local akkauntlarining paroli
-- `student-<uuid>-hanguk-A1!` edi — emaildan hisoblab topiladi (2026-11-05 da
-- 54 tadan 54 tasi shunday). Talabalar parol kiritmaydi: kirish magic code
-- orqali, student-login-v2 sessiyani bir martalik token bilan yaratadi.
-- Shuning uchun parol shunchaki tasodifiyga almashtiriladi. Ochiq sessiyalar
-- (refresh token) o'chmaydi — talabalar ilovadan chiqib ketmaydi.
-- Faqat taxmin qilinadigan parollar almashtiriladi.
update auth.users u
   set encrypted_password = extensions.crypt(
         encode(extensions.gen_random_bytes(32), 'base64'),
         extensions.gen_salt('bf')),
       updated_at = now()
 where u.email like 'student-%@hanguk.local'
   and (
        u.encrypted_password = extensions.crypt('student-' || u.id || '-hanguk-A1!', u.encrypted_password)
     or u.encrypted_password = extensions.crypt('student-' || coalesce(u.raw_user_meta_data->>'original_user_id', '-') || '-hanguk-A1!', u.encrypted_password)
     or u.encrypted_password = extensions.crypt('student-' || split_part(split_part(u.email, '@', 1), 'student-', 2) || '-hanguk-A1!', u.encrypted_password)
   );
