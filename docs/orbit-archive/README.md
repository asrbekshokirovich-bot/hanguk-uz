# Orbit bot kodi arxivi

2026-11-03 da Orbit (zqpglkxbtpkvyraxquao) botlari to'xtatildi: edge `telegram-bot` (v21, @OrbitFABOT yuklovchisi; asl bot kodi Orbit bazasidagi `_bot_code` jadvalida) va `staff-bot` (v1, @OrbitFSBOT) o'rniga «@STAFF_HANGUK_BOT ga o'ting» javobi joylandi; 4 cron (orbit-sync-tasks, orbit-sync-finance, staff_remind, staff_digest) active=false.
Qayta yoqish: shu fayllarni Orbit'ga deploy qilish va `select cron.alter_job(jobid, active := true) from cron.job;`.
