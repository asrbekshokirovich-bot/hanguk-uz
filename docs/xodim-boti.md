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
| har 5 daqiqa (har kuni) | AI navbati (`bot_jobs`) qayta bajariladi + AI holati ogohlantirishi (`?action=jobs`) | `staff-bot-jobs` |
| 02:40 | 90 kundan eski `ai_calls` va yakunlangan `bot_jobs` o'chiriladi | `staff-bot-ai-retention` |

Sozlamalar saqlanganda `bot_apply_schedule()` cron'ni qayta tuzadi (vaqt 05:00–23:59 oralig'ida); `staff-bot-jobs` va `staff-bot-ai-retention`ga tegmaydi.

## Arxitektura
- Edge: `supabase/functions/staff-bot/` — `index.ts` (webhook, DM, guruh, cron yo'llari), `core.ts` (sof funksiyalar, testlar `core_test.ts`), `ai.ts` (provayderlar, testlar `ai_test.ts`), `aiops.ts` (AI jurnali, navbat, ogohlantirish; testlar `aiops_test.ts`).
- Edge: `tv-board` — ofis TV (hanguk.uz/tv) ma'lumoti, `?k=` kalit (`bot_settings.tv_key`, faqat owner ko'radi).
- Webhook himoyasi: `secret_token` = SHA-256(`STAFF_BOT_WEBHOOK_SECRET`). Cron yo'llari (`?action=morning|report|jobs`) — Supabase secret key (`apikey`).
- Secrets: `STAFF_BOT_TOKEN`, `STAFF_BOT_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`; ixtiyoriy `STAFF_BOT_GEMINI_MODEL` (standart gemini-2.5-flash), `STAFF_BOT_CLAUDE_MODEL` (standart claude-haiku-5-5).
- AI: hisobotni 3 qismga ajratish va guruh tahlili — «AI qatlami va navbat» bo'limiga qarang. Ovozni matnga faqat Gemini aylantiradi.
- «Savol»: bot xodim nomidan qisqa sessiya ochadi (`auth.admin.generateLink` → `verifyOtp`, email yuborilmaydi), `hanguk-ai-chat`ga shu JWT bilan so'raydi, keyin `auth.admin.signOut`.

## AI qatlami va navbat (2026-11-05, reja B0-2, B0-3, B0-5)
- **Tartib:** `bot_settings.ai_provider_order` (standart `claude,gemini` — D1; UI'da yo'q, bazada o'zgartiriladi, 60 s kesh). Kaliti yo'q provayder o'tkazib yuboriladi.
- **Qayta urinish:** har provayderda 429/503/529 bo'lsa ~1,5 s kutib bitta qayta urinish, keyin keyingi provayder. So'rov chegarasi 25 s. Claude'ga `temperature` yuborilmaydi (#574).
- **Tekshiruv:** javob sxemaga (majburiy maydon, tur, enum) mos kelmasa — xato, keyingi provayder.
- **Jurnal `ai_calls`:** har urinish — maqsad (`group_analysis`, `report_split`), provayder, model, ok, HTTP status, qisqa xato, ms, kirish/chiqish tokenlari, narx (Claude — rasmiy narx: Haiku 5.5 $0,10 / $0,50, Sonnet 5.5 $2 / $10 1 mln token uchun; Gemini — null). 90 kun.
- **Navbat `bot_jobs`:** guruh tahlili yoki hisobotni ajratish provayder xatosi bilan natija bermasa (AI «hech narsa yo'q» degani emas) — ish navbatga tushadi (`ga:<chat>:<xabar>`, `rs:<hisobot>`). `staff-bot-jobs` muddati kelganini qayta bajaradi: muvaffaqiyat → `done` (hisobotda `daily_reports` done/blockers/plan, `ai_parsed=true` — `bot_report_apply_split`, matn o'zgarmagan bo'lsa); xato → `attempts+1`, 5 daqiqadan keyin; 3-xatodan keyin `failed`. Guruh tahlili qayta bajarilganda rejim (off/shadow/on) va dublikat himoya o'sha; muddat xabar yozilgan vaqtga nisbatan.
- **Ogohlantirish:** `?action=jobs` oxirida — oxirgi 60 daqiqada ≥5 chaqiruv va xato ≥20% yoki yangi `failed` ish bo'lsa xulosa oluvchilarga (`bot_owner_chats`) DM «⚠️ AI: nosozlik»; soatiga ko'pi bilan 1 ta (`bot_alerts`), 22:00–08:00 da yuborilmaydi.
- **18:15 xulosa** oxirida: «🤖 AI (24 soat): N chaqiruv, X xato, $Y» (`bot_ai_stats`).
- **CRM:** Sozlamalar → Bot → «AI holati» (`BotAiHealthCard`, RPC `bot_ai_health`, faqat owner): maqsad/provayder kesimida chaqiruv, xato, o'rtacha ms, token, narx; navbatdagi va bajarilmagan ishlar; oxirgi xato.
- Migratsiya qo'llanmagan bo'lsa ham bot ishlaydi: jurnal/navbat xatolari faqat loglanadi.

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
| `ai_calls` | AI urinishlari jurnali (90 kun) | owner |
| `bot_jobs`, `bot_alerts` | AI qayta urinish navbati, ogohlantirish vaqti | faqat service |

Bot RPC'lari (`bot_*`) faqat `service_role` uchun; CRM RPC'lari: `crm_daily_reports`, `bot_settings_overview`, `bot_settings_save` (owner), `bot_ai_health` (owner), `staff_telegram_link_code`, `staff_telegram_unlink`.

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
