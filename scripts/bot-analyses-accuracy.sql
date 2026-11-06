-- Xodim boti B2-3: bot_analyses yozuvlaridan baholash jadvalini chiqarish
-- Foydalanish: faqat SELECT, prod'ga yozmaydi.
-- su postgres -c "psql ..." yoki Supabase SQL editor / execute_sql orqali ishga tushiring.
--
-- Bu so'rov har bir tahlil qilingan guruh xabari uchun:
--   - xabar matni (staff_group_messages.text)
--   - AI topgan kind(lar) va confidence
--   - AI result.findings[0].reason (model izohi)
-- ni bir qatorda chiqaradi, shu asosda qo'lda "kutilgan_kind" ustunini to'ldirish mumkin.
select
  a.id,
  a.created_at,
  a.chat_id,
  a.message_id,
  m.text as message_text,
  a.kinds as ai_kinds,
  a.confidence as ai_confidence,
  a.mode,
  a.result -> 'findings' -> 0 ->> 'reason' as ai_reason,
  a.result -> 'findings' -> 0 ->> 'task_title' as ai_task_title,
  a.result -> 'findings' -> 0 ->> 'due' as ai_due
from bot_analyses a
left join staff_group_messages m
  on m.chat_id = a.chat_id and m.message_id = a.message_id
order by a.id;
