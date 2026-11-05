# Xodim boti (@STAFF_HANGUK_BOT)

Orbit o'rniga Hanguk saytining o'zida ishlaydigan Telegram bot: xodimlar bir-biriga vazifa beradi,
17:00 da kunlik hisobot topshiradi, guruhdagi suhbatdan vazifa takliflari chiqadi, Hanguk AI'ga savol beriladi.
Vazifalar CRM'dagi `tasks` jadvalining o'zida (`source = 'telegram'`) — alohida baza yo'q.

## Xodim uchun (qisqa)

| Qayerda | Nima | Qanday |
|---|---|---|
| DM | 📋 Vazifalarim | ochiq vazifalar; ▶ Boshladim / ✅ Bajardim |
| DM | ➕ Vazifa berish | hamkasb → matn/ovoz → tasdiq; «ertaga 15:00», «juma», «05.11», «zarur» |
| DM | 📝 Hisobot | 17:00 da so'raladi; bitta xabar (matn/ovoz); qayta yozsa yangilanadi |
| DM | 🤖 Savol | Hanguk AI; xodimning CRM ruxsatlari doirasida |
| Guruh | `#vazifa @username matn` | vazifa + karta; mas'ul kartaga «✅»/«bajarildi» → yopiladi |
| Guruh | oddiy suhbat | AI taklif qiladi (rejim «Yoqilgan» bo'lsa), yozgan odam ✅ bossagina yaratiladi |
| Guruh | har ish kuni 09:00 | jamoa xulosasi: har xodimning kechikkan va bugungi vazifalari (hammasi), lidlar, hujjatlar, ariza muddatlari, kechagi hisobot (topshirmaganlar ismi bilan) |

To'liq qo'llanma botda: `/help`.

## Ulash
CRM → Xodimlar → xodim → **Telegram bot** kartasi → «Ulash havolasi» (15 daqiqa, bir martalik) → xodimga yuboriladi → u Start bosadi.
Bot foydalanuvchi nomidan ID topa olmaydi, shuning uchun xodimning o'zi bir marta Start bosishi shart.

## Jadval (Toshkent, Du–Sha; CRM → Sozlamalar → Bot'da o'zgaradi)
| Vaqt | Ish | cron |
|---|---|---|
| 09:00 | «Staff» guruhiga jamoa xulosasi (`bot_group_digest`; `group_digest_enabled`) + har xodimga DM: brifing, kechikkan va bugungi vazifalar | `staff-bot-morning` |
| 17:00 | hisobot so'rovi | `staff-bot-report-ask` |
| 17:30, 18:00 | eslatma (topshirmaganlarga) | `staff-bot-report-remind1..3` |
| 18:15 | ownerlarga (yoki tanlanganlarga) xulosa | `staff-bot-report-summary` |
| har soat | 24 soatlik takliflar → expired | `staff-bot-proposals-expire` |
| 02:30 | 90 kundan eski guruh xabarlari o'chiriladi | `staff-bot-group-retention` |

Sozlamalar saqlanganda `bot_apply_schedule()` cron'ni qayta tuzadi (vaqt 05:00–23:59 oralig'ida).

## Arxitektura
- Edge: `supabase/functions/staff-bot/` — `index.ts` (webhook, DM, guruh, cron yo'llari), `core.ts` (sof funksiyalar, testlar `core_test.ts`), `ai.ts` (Gemini → Claude zaxira).
- Edge: `tv-board` — ofis TV (hanguk.uz/tv) ma'lumoti, `?k=` kalit (`bot_settings.tv_key`, faqat owner ko'radi).
- Webhook himoyasi: `secret_token` = SHA-256(`STAFF_BOT_WEBHOOK_SECRET`). Cron yo'llari (`?action=morning|report`) — Supabase secret key (`apikey`).
- Secrets: `STAFF_BOT_TOKEN`, `STAFF_BOT_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`; ixtiyoriy `STAFF_BOT_GEMINI_MODEL` (standart gemini-2.5-flash), `STAFF_BOT_CLAUDE_MODEL` (standart claude-haiku-5-5).
- AI: hisobotni 3 qismga ajratish va guruh tahlili — avval Gemini, ishlamasa Claude (`tool_use` bilan aniq JSON). Ovozni matnga faqat Gemini aylantiradi.
- «Savol»: bot xodim nomidan qisqa sessiya ochadi (`auth.admin.generateLink` → `verifyOtp`, email yuborilmaydi), `hanguk-ai-chat`ga shu JWT bilan so'raydi, keyin `auth.admin.signOut`.

## Baza (migratsiyalar 2026-10-31 … 2026-11-03)
| Jadval | Vazifasi | O'qiydi |
|---|---|---|
| `staff_telegram_links`, `staff_link_codes` | xodim ↔ Telegram | o'zi, owner, admin |
| `bot_settings` | vaqtlar, guruh, AI rejimi, TV kaliti | xodimlar (`tv_key` — faqat owner) |
| `bot_state`, `telegram_updates_seen` | ko'p bosqichli oqim, dublikat himoya | faqat service |
| `task_events` | vazifa voqealari (via crm/dm/group/cron) | vazifani ko'ra oladigan |
| `daily_reports` | kunlik hisobot (bir kunga bitta) | o'zi, owner, admin |
| `staff_group_messages` | guruh xabarlari (90 kun) | owner |
| `bot_group_cards` | guruh kartasi → vazifa | faqat service |
| `bot_proposals` | AI takliflari (shadow/on, holati) | owner |

Bot RPC'lari (`bot_*`) faqat `service_role` uchun; CRM RPC'lari: `crm_daily_reports`, `bot_settings_overview`, `bot_settings_save` (owner), `staff_telegram_link_code`, `staff_telegram_unlink`.

## Guruh AI ishonchliligi
1. Aniq buyruqlar (`#vazifa`, kartaga ✅) — deterministik.
2. AI faqat taklif: ishonch ≥ 0.75, xodim aniq mos kelishi, mavjud vazifaga o'xshamasligi; yopishda vazifa id'si AI'dan emas, ro'yxatdagi raqamdan.
3. Tasdiqsiz hech narsa yaratilmaydi/yopilmaydi; 24 soatda tasdiqlanmasa — expired.
4. Vazifa holatini botda (▶/✅, guruhda ✅, AI yopish taklifi) **faqat mas'ul** o'zgartiradi; bergan odam va owner CRM orqali yopadi.
Rejim: `off` | `shadow` (standart — faqat `bot_proposals`, guruhga chiqmaydi) | `on`.

## Orbit
Orbit loyihasi (zqpglkxbtpkvyraxquao) 2026-10-28 dan to'xtatilgan. Hanguk'dagi Orbit triggerlari
(`tasks`: `trg_orbit_instant_sync`, `trg_orbit_signal`; `leads`, `payments`: `trg_orbit_signal`) **DISABLE** qilingan —
qayta yoqish: `alter table public.<jadval> enable trigger <nom>;`.
