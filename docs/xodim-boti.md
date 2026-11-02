# Xodim boti (staff-bot)

Hanguk xodimlari uchun Telegram bot: vazifalar, 17:00 kunlik hisobot, xodimlar
guruhi tahlili, Hanguk AI. Reja va bosqichlar: loyiha hujjati
`claude/xodim-boti-reja.md` (to'liq: claude.ai/artifact/76EhC3E9Lnkc2Dr5kgAF1v).

Hozirgi holat (PR-1): ulash, DM menyusi, «Vazifalarim» (faqat o'qish),
guruhga qo'shilganda guruh id'sini eslab qolish.

## Bir martalik sozlash

1. BotFather'da bot yarating (masalan `@HangukTeamBot`). `/setprivacy → Disable`
   (guruhdagi hamma xabarni ko'rishi uchun; keyin botni guruhga qayta qo'shish kerak).
2. Supabase → Edge Functions → Secrets:
   - `STAFF_BOT_TOKEN` — BotFather bergan token
   - `STAFF_BOT_WEBHOOK_SECRET` — istalgan uzun tasodifiy satr
3. Funksiya deploy bo'lgach brauzerda bir marta oching:
   `https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=setup`
   Javobda `ok: true` va `bot: "<username>"` bo'lishi kerak. Bu webhook'ni
   ro'yxatdan o'tkazadi, buyruqlar ro'yxatini qo'yadi va `bot_settings.bot_username`
   ni yozadi (CRM'dagi ulash havolasi shunga tayanadi).
   Tekshirish: `...?action=status`.
4. Botni xodimlar guruhiga qo'shib **admin** qiling — bot guruh id'sini
   `bot_settings.group_chat_id` ga o'zi yozadi (faqat birinchi guruh).

## Xodimni ulash

CRM → Xodimlar → xodim → «Telegram'ga ulash» (PR-2). Havola
`https://t.me/<bot>?start=KOD` 15 daqiqa amal qiladi, bir marta ishlaydi.
Xodim havolani ochadi — bot uni `staff_telegram_links` ga yozadi. Uzish — o'sha
sahifada; xodim CRM'dan o'chirilsa bog'lanish ham o'chadi.

Bitta Telegram akkaunti bir vaqtda faqat bitta faol xodimga ulanadi.

## Jadvallar (migratsiya `20261031130000_staff_bot_core.sql`)

| Jadval | Nima |
|---|---|
| `staff_telegram_links` | xodim ↔ Telegram (user_id PK, telegram_user_id, dm_chat_id, is_active) |
| `staff_link_codes` | ulash kodlari (15 daqiqa, used_at) |
| `bot_settings` | sozlamalar: bot_username, group_chat_id, report_time 17:00, reminder_times, digest_time, morning_time, workdays 1–6, auto_create_policy, group_retention_days, digest_user_ids |
| `bot_state` | DM'dagi ko'p bosqichli oqim holati |
| `telegram_updates_seen` | takror update himoyasi |
| `task_events` | vazifa o'zgarishlari jurnali (trigger `trg_task_events`; via: crm / dm / group / cron / system) |

RPC: `staff_telegram_link_code(user_id)` va `staff_telegram_unlink(user_id)` —
CRM (o'zi, owner, admin); `bot_link_telegram`, `bot_resolve_staff` — faqat
service_role. View `v_staff_telegram` — Xodimlar sahifasi uchun holat.

Bot yoki cron vazifani RPC orqali o'zgartirganda `app.task_via` / `app.task_actor`
GUC'larini o'rnatadi — trigger voqeani to'g'ri manba bilan yozadi (PR-3).

## Sinov

```
deno test supabase/functions/staff-bot/core_test.ts
```
Migratsiya lokal PG16 da stub sxema bilan sinaldi (kod → ulash → takror kod «used»
→ uzish → operator boshqaga kod bera olmaydi → trigger CRM/DM manbasi).
