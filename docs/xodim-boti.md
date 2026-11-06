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
| Guruh, DM | vazifa kartasiga javob (reply) | oddiy matn → izoh (CRM «Faollik», ikkinchi tomonga DM); bergan yoki owner: «ertaga 15:00», «05.11», «juma» → muddat, `@username` → boshqa xodimga |
| Guruh | ovozli xabar | fonda matnga (Scribe, zaxira Gemini) → «🎤 …» bo'lib saqlanadi va tahlil qilinadi; ovozdan `#vazifa` chiqmaydi |
| Guruh | oddiy suhbat | AI taklif qiladi (rejim «Yoqilgan» bo'lsa), yozgan odam ✅ bossagina yaratiladi |
| Guruh | rasm | izohi (caption) bo'lsa — matn sifatida saqlanadi va tahlil qilinadi; izohsiz rasm faqat saqlanadi |
| Guruh | xabarni tahrirlash | bazadagi matn yangilanadi (`edited_at`); qayta tahlil qilinmaydi, `#vazifa` qayta bajarilmaydi |
| Guruh | reaksiya (👍, ✅ …) | `staff_group_reactions`ga saqlanadi (bot kartasiga bo'lsa — `task_id` bilan); hozircha hech narsani o'zgartirmaydi |
| Guruh | har ish kuni 09:00 | jamoa xulosasi: har xodimning kechikkan va bugungi vazifalari (hammasi), lidlar, hujjatlar, ariza muddatlari, kechagi hisobot (topshirmaganlar ismi bilan), «💬 Kecha guruhda» — oxirgi ish kunining qisqa xulosasi |
| DM | 🔔 bildirishnomalar | CRM'da berilgan / o'tkazilgan / muddati o'zgargan / bekor qilingan vazifa, «▶ boshladi», CRM'da yopildi; muddatga 1 soat qoldi, muddat o'tdi (22:00–08:00 da jim) |

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
| 21:30 (ish kunlari — edge'da `workdays` tekshiriladi) | kunlik guruh xulosasi → `group_daily_summaries` (xabar yuborilmaydi) | `staff-bot-group-summary` |
| 02:30 | 90 kundan eski guruh xabarlari o'chiriladi | `staff-bot-group-retention` |
| har 5 daqiqa (har kuni) | AI navbati (`bot_jobs`) qayta bajariladi + AI holati ogohlantirishi (`?action=jobs`) | `staff-bot-jobs` |
| 02:40 | 90 kundan eski `ai_calls` va yakunlangan `bot_jobs` o'chiriladi | `staff-bot-ai-retention` |
| darhol + har 5 daqiqa, 08:00–21:55 (har kuni) | bildirishnomalar navbati (`bot_notifications`) → DM; tunda yig'iladi, 08:00 da ketadi | `staff-bot-notify` |
| har 15 daqiqa, 08:00–21:45 (ish kunlari — `workdays`; yakshanbagisi dushanba 08:00 da) | muddat nazorati: 1 soat qoldi → mas'ul; o'tdi → mas'ul + beruvchi; 2 kundan oshdi → ownerlarga yig'ma | `staff-bot-deadlines` |

Sozlamalar saqlanganda `bot_apply_schedule()` cron'ni qayta tuzadi (vaqt 05:00–23:59 oralig'ida). `staff-bot-jobs`, `staff-bot-ai-retention`, `staff-bot-notify`, `staff-bot-deadlines` va `staff-bot-group-summary` migratsiyalarda qo'yilgan (`20261106060000`, `20261106061000`, `20261106110000`) — `bot_apply_schedule()` ularga tegmaydi.

## Bildirishnomalar va muddat nazorati
`task_events` → trigger `trg_task_events_notify` → `bot_notifications` (outbox) → shu zahoti `net.http_post(?action=notify)`; zaxira — cron.
O'zgartirgan odamga (actor) xabar bormaydi; `via = system` (Orbit importi) va test akkauntlar — hech qachon.

| Voqea | Qayerda | Kimga |
|---|---|---|
| yaratildi | CRM | mas'ul (▶/✅ kartasi bilan) |
| boshqa odamga o'tkazildi | CRM | yangi mas'ul (karta) va eski mas'ul |
| ▶ boshladi | bot yoki CRM | beruvchi |
| bajarildi | CRM | beruvchi (bot/guruhda yopilgani — `index.ts` o'zi darhol yozadi) |
| bekor qilindi / muddat o'zgardi | CRM | mas'ul |

Bitta saqlashda bitta vazifa bo'yicha bitta odamga bitta xabar. 24 soatdan eski navbat yuborilmaydi (`stale`), ulanmagan odam — `skipped`.
Muddat: soatli muddat — 60 daqiqa qolganda (`due_soon`); kechikish — soatli bo'lsa muddatning o'zi, faqat sana (00:00 UTC yoki 00:00 Toshkent)
bo'lsa o'sha kunning oxiri. Har eslatma bir marta: `task_reminders (task_id, kind, due_date)`, muddat o'zgarsa yana ishlaydi.
Eski sana bilan (muddati o'tib bo'lgach) yaratilgan vazifaga «muddat o'tdi» yuborilmaydi; owner'ga — yaratilganidan 2 kun keyin.
Migratsiya paytida allaqachon kechikkan vazifalar `note = 'baseline'` bilan «muddat o'tdi — yuborilgan» deb belgilangan (eski Orbit vazifalari bo'yicha xabar ketmaydi); ownerlarga eskalatsiya ham faqat 2 kuni allaqachon to'lganlar uchun belgilangan, qolganlari o'z vaqtida boradi.

## Arxitektura
- Edge: `supabase/functions/staff-bot/` — `index.ts` (webhook, DM, guruh, cron yo'llari), `core.ts` (sof funksiyalar, testlar `core_test.ts`), `ai.ts` (provayderlar, testlar `ai_test.ts`), `aiops.ts` (AI jurnali, navbat, ogohlantirish; testlar `aiops_test.ts`), `notify.ts` (bildirishnomalar navbati va muddat nazorati, testlar `notify_test.ts`), `voice.ts` (ovoz → matn: Scribe → Gemini, guruh ovozi; `voice_test.ts`), `cards.ts` (kartaga javobni ajratish, sof; `cards_test.ts`) va `card_actions.ts` (RPC + xabarlar), `analysis.ts` (guruh tahlili 2.0; `analysis_test.ts`), `intake.ts` (guruhdagi tahrir va reaksiya; `intake_test.ts`), `summary.ts` (kunlik guruh xulosasi; `summary_test.ts`).
- Edge: `tv-board` — ofis TV (hanguk.uz/tv) ma'lumoti, `?k=` kalit (`bot_settings.tv_key`, faqat owner ko'radi).
- Webhook himoyasi: `secret_token` = SHA-256(`STAFF_BOT_WEBHOOK_SECRET`). Cron yo'llari (`?action=morning|report|jobs|notify|deadlines|group_summary`) — Supabase secret key (`apikey`).
- Secrets: `STAFF_BOT_TOKEN`, `STAFF_BOT_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` (Scribe; bo'lmasa ovoz faqat Gemini bilan); ixtiyoriy `STAFF_BOT_GEMINI_MODEL` (standart gemini-2.5-flash), `STAFF_BOT_CLAUDE_MODEL` (standart claude-haiku-5-5).
- AI: hisobotni 3 qismga ajratish va guruh tahlili — «AI qatlami va navbat» bo'limiga qarang.
- Ovoz → matn (DM: vazifa, hisobot, savol; guruh): ElevenLabs Scribe (`_shared/scribe.ts`, `uzb`, fayl `voice.ogg`), xato, bo'sh javob yoki 30 s dan oshsa — Gemini. Logda: `staff-bot voice: via scribe|gemini …` yoki `… voice not transcribed`.
- Kartaga javob: guruhda `bot_group_cards` orqali, DM'da kartaning tugmasidagi id (`td:`/`ts:`, bergan odamga — `tr:` «💬 Javob yozish»). Muddat/@odam faqat javob shu iboradan iborat bo'lsa (boshqa so'z qolsa — izoh). Xabarlar: izoh → ikkinchi tomonga (owner yozsa ikkalasiga), muddat → mas'ulga, o'tkazish → yangi mas'ulga karta (▶/✅) va eskisiga.
- «Savol»: bot xodim nomidan qisqa sessiya ochadi (`auth.admin.generateLink` → `verifyOtp`, email yuborilmaydi), `hanguk-ai-chat`ga shu JWT bilan so'raydi, keyin `auth.admin.signOut`.

## AI qatlami va navbat (2026-11-05, reja B0-2, B0-3, B0-5)
- **Tartib:** `bot_settings.ai_provider_order` (standart `claude,gemini` — D1; UI'da yo'q, bazada o'zgartiriladi, 60 s kesh). Kaliti yo'q provayder o'tkazib yuboriladi.
- **Qayta urinish:** har provayderda 429/503/529 bo'lsa ~1,5 s kutib bitta qayta urinish, keyin keyingi provayder. So'rov chegarasi 25 s. Claude'ga `temperature` yuborilmaydi (#574).
- **Tekshiruv:** javob sxemaga (majburiy maydon, tur, enum) mos kelmasa — xato, keyingi provayder.
- **Jurnal `ai_calls`:** har urinish — maqsad (`group_analysis`, `report_split`), provayder, model, ok, HTTP status, qisqa xato, ms, kirish/chiqish tokenlari, narx (Claude — rasmiy narx: Haiku 5.5 $0,10 / $0,50, Sonnet 5.5 $2 / $10 1 mln token uchun; Gemini — null). 90 kun.
- **Navbat `bot_jobs`:** guruh tahlili yoki hisobotni ajratish provayder xatosi bilan natija bermasa (AI «hech narsa yo'q» degani emas) — ish navbatga tushadi (`ga:<chat>:<xabar>`, `rs:<hisobot>`). `staff-bot-jobs` muddati kelganini qayta bajaradi: muvaffaqiyat → `done` (hisobotda `daily_reports` done/blockers/plan, `ai_parsed=true` — `bot_report_apply_split`, matn o'zgarmagan bo'lsa); har urinish `attempts+1`; xato → 5 daqiqadan keyin qayta; 3-urinish ham xato bo'lsa `failed` (jarayon uzilsa ham ish yo'qolmaydi — 10 daqiqalik ijara tugagach qayta olinadi). Guruh tahlili qayta bajarilganda rejim (off/shadow/on) va dublikat himoya o'sha; muddat xabar yozilgan vaqtga nisbatan.
- **Ogohlantirish:** `?action=jobs` oxirida — oxirgi 60 daqiqada ≥5 chaqiruv va xato ≥20% yoki yangi `failed` ish bo'lsa xulosa oluvchilarga (`bot_owner_chats`) DM «⚠️ AI: nosozlik»; soatiga ko'pi bilan 1 ta (`bot_alerts`), 22:00–08:00 da yuborilmaydi.
- **18:15 xulosa** oxirida: «🤖 AI (24 soat): N chaqiruv, X xato, $Y» (`bot_ai_stats`).
- **CRM:** Sozlamalar → Bot → «AI holati» (`BotAiHealthCard`, RPC `bot_ai_health`, faqat owner): maqsad/provayder kesimida chaqiruv, xato, o'rtacha ms, token, narx; navbatdagi va bajarilmagan ishlar; oxirgi xato.
- Migratsiya qo'llanmagan bo'lsa ham bot ishlaydi: jurnal/navbat xatolari faqat loglanadi.

## Kunlik guruh xulosasi (2026-11-06, reja B3-1, D8)
- **Qachon:** har kuni 21:30 cron `?action=group_summary`; dam olish kuni (`workdays`'da yo'q) — hech narsa. `bot_settings.group_summary_enabled = false` — o'chiq (UI'da hali yo'q). Qo'lda: `?action=group_summary&date=YYYY-MM-DD[&chat=<id>]` (ish kuni tekshirilmaydi, qayta yozadi).
- **Nima kiradi:** o'sha kun (Toshkent) «Staff» guruhidagi matnli xabarlar — oddiy matn, «🎤» ovoz transkripti, rasm/fayl izohi (`bot_group_day_messages`). Ulangan xodim — ismi bilan, ulanmagan akkaunt — «tashqi», test akkauntlar chiqariladi. Xabar 3 tadan kam bo'lsa AI chaqirilmaydi, hech narsa yozilmaydi.
- **AI:** `aiOps.structured('group_summary')` — AI qatlami tartibi (Claude Haiku 5.5, zaxira Gemini), `ai_calls`'ga yoziladi. Natija: 3–6 band (`summary`, «• …» satrma-satr), `topics`, `decisions`, `open_questions`, `message_count`, `model`. Provayderlar xato bersa — `bot_jobs` (`group_summary`, kalit `gs:<chat>:<sana>`), `staff-bot-jobs` qayta urinadi.
- **Ertalab (D8):** 09:00 guruh xulosasining oxirida «💬 Kecha guruhda» (dushanba — «Shanba kuni guruhda»): oxirgi ish kuni xulosasining 5 tagacha bandi. Xulosa bo'lmasa bo'lim chiqmaydi. `bot_group_digest` o'zgarmagan — edge alohida `bot_group_summary_get` bilan o'qiydi.
- **Kim ko'radi:** `group_daily_summaries` — faqat owner (D3); Hanguk AI tool'i (B3-3) shu jadvalni o'qiydi.

## Guruh tahlili 2.0 (2026-11-06, reja B2-1, B2-2)
- **Kirish:** ulangan xodimning matni, rasm izohi va ovozi («🎤 …»). Ulanmagan akkaunt xabarlari saqlanadi, tahlil qilinmaydi (D7).
- **Kontekst:** oldingi 20 ta xabar (`[#id ↩#javob] Ism: [rasm] matn`), javob berilgan xabar (oynadan tashqarida bo'lsa ham), xodimlar ro'yxati va jamoaning ochiq vazifalari — `bot_analysis_context` (ko'pi bilan 40, oxirgi o'zgargani birinchi, faqat xodimlarniki, test akkauntlarsiz). Migratsiya qo'llanmagan bo'lsa — eski `bot_group_context`.
- **Natija turlari:** `new_task`, `close_task`, `update_task` (muddat/mas'ul), `question` (javob talab qiladigan savol), `decision` (qaror/qoida), `none`; har birida ishonch, sabab, vazifa raqami (ro'yxatdan → id), mas'ul. O'ziga va'da («aniqlashtirib aytaman») — `new_task`, ishonch ≤ 0.6 (taklif bo'lmaydi).
- **`bot_analyses`:** har tahlil (none ham) — xabar, muallif, provayder/model, rejim, turlar, eng yuqori ishonch, `result` (topilmalar: `proposed`, taklif qilinmagan bo'lsa `skip` sababi). 90 kun (`bot_analysis_retention`, cron `staff-bot-analysis-retention` 02:50).
- **Takliflar:** faqat `new_task`/`close_task` → `bot_proposals` (avvalgidek: rejim, ishonch ≥ 0.75, har turdan bitta). Dublikat himoya: o'xshash ochiq vazifa, shu vazifaga kutilayotgan yopish taklifi, 24 soatda shu xodimga o'xshash `create` taklifi. `update_task`/`question`/`decision` hozircha faqat `bot_analyses`da.
- **Webhook:** `allowed_updates` = message, edited_message, callback_query, my_chat_member, message_reaction — o'zgargach `?action=setup` qayta ochilishi kerak. Reaksiyalar faqat bot guruhda **admin** bo'lsa keladi.

## Baza (migratsiyalar 2026-10-31 … 2026-11-06)
| Jadval | Vazifasi | O'qiydi |
|---|---|---|
| `staff_telegram_links`, `staff_link_codes` | xodim ↔ Telegram | o'zi, owner, admin |
| `bot_settings` | vaqtlar, guruh, AI rejimi, TV kaliti | xodimlar (`tv_key` — faqat owner) |
| `bot_state`, `telegram_updates_seen` | ko'p bosqichli oqim, dublikat himoya | faqat service |
| `task_events` | vazifa voqealari (via crm/dm/group/cron) | vazifani ko'ra oladigan |
| `task_comments` | vazifa izohlari (CRM «Faollik»); botdagi kartaga javob ham shu yerga, muallif = xodim | owner, admin, operator, hujjatchi |
| `daily_reports` | kunlik hisobot (bir kunga bitta) | o'zi, owner, admin |
| `staff_group_messages` | guruh xabarlari (90 kun; `edited_at` — tahrir) | owner |
| `staff_group_reactions` | guruhdagi reaksiyalar (xabar + odam; bot kartasiga — `task_id`) | owner |
| `bot_analyses` | har guruh tahlili natijasi (none ham), 90 kun | owner |
| `bot_group_cards` | guruh kartasi → vazifa | faqat service |
| `bot_proposals` | AI takliflari (shadow/on, holati) | owner |
| `group_daily_summaries` | kunlik guruh xulosasi (chat, sana) | owner |
| `ai_calls` | AI urinishlari jurnali (90 kun) | owner |
| `bot_jobs`, `bot_alerts` | AI qayta urinish navbati, ogohlantirish vaqti | faqat service |
| `bot_notifications` | bildirishnomalar navbati: pending → sent / skipped / failed | faqat service |
| `task_reminders` | muddat eslatmalari (bir marta; `baseline` — migratsiyada belgilangan) | faqat service |

Bot RPC'lari (`bot_*`) faqat `service_role` uchun (kartadan: `bot_set_task_due`, `bot_reassign_task` — bergan yoki owner; `bot_add_task_comment` — mas'ul, bergan yoki owner; hammasi `app.task_via`/`app.task_actor` bilan); CRM RPC'lari: `crm_daily_reports`, `bot_settings_overview`, `bot_settings_save` (owner), `bot_ai_health` (owner), `staff_telegram_link_code`, `staff_telegram_unlink`.

## Guruh AI ishonchliligi
1. Aniq buyruqlar (`#vazifa`, kartaga ✅) — deterministik.
2. AI faqat taklif: ishonch ≥ 0.75, xodim aniq mos kelishi, mavjud vazifaga o'xshamasligi; yopishda vazifa id'si AI'dan emas, ro'yxatdagi raqamdan.
3. Tasdiqsiz hech narsa yaratilmaydi/yopilmaydi; 24 soatda tasdiqlanmasa — expired.
4. Vazifa holatini botda (▶/✅, guruhda ✅, AI yopish taklifi) **faqat mas'ul** o'zgartiradi; bergan odam va owner CRM orqali yopadi. Muddat va mas'ulni kartadan **bergan yoki owner** o'zgartiradi.
Rejim: `off` | `shadow` (standart — faqat `bot_proposals`, guruhga chiqmaydi) | `on`.

## Orbit
Orbit loyihasi (zqpglkxbtpkvyraxquao) 2026-10-28 dan to'xtatilgan. Hanguk'dagi Orbit triggerlari
(`tasks`: `trg_orbit_instant_sync`, `trg_orbit_signal`; `leads`, `payments`: `trg_orbit_signal`) **DISABLE** qilingan —
qayta yoqish: `alter table public.<jadval> enable trigger <nom>;`.
