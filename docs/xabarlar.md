# CRM → Xabarlar (operator navbati)

Bo'lim: `src/components/crm/pages/MessagesContent.tsx` + `src/components/crm/messages/*`,
ma'lumot: `src/contexts/MessagesContext.tsx` (butun CRM'da yuklangan).
Baza: `message_threads`, `messages`, RPC `get_thread_previews(p_id)` (tur `thread_preview`).

Audit 2026-10-29 (`xabarlar_auditi.html`) dan keyin joriy qilingan qoidalar — kelajakda
o'zgartirganda shularga tayaning.

## Navbat qoidalari

| Qoida | Qayerda |
|---|---|
| Hech bir suhbat o'z-o'zidan ochilmaydi va **o'qilgan deb belgilanmaydi** — faqat operator bosganda (`mark_thread_read`). | `MessagesContent.tsx` (`activeId` faqat `selectedId`) |
| Default tab **Kutmoqda**: odam yozgan va bizdan **odam** javob bermagan suhbatlar, yangisi tepada. | `queueLogic.ts` `matchesTab`, `sortConversations` |
| "Kutmoqda" = `last_incoming_at > last_human_out_at`. Avto-javoblar (bot, ish vaqtidan tashqari matn, Meta instant reply — `fn_is_automatic_outgoing`) va ichki eslatmalar javob hisoblanmaydi. | `get_thread_previews` (migr. `20261031100000`) |
| 30 kundan eski kutayotgan suhbatlar ro'yxat oxiridagi "eski suhbatlar (N)" tugmasi ostida. | `STALE_AFTER_DAYS` |
| Faqat `kind = 'lead'` suhbatlar navbatda. `staff` / `partner` / `service` — "Xodimlar" chipida. Turini sarlavhadagi "⋯" menyusidan o'zgartirish mumkin. | `message_threads.kind`, `matchesChannel` |
| Yashirin qatorlar (`[template]` bo'sh Meta kartochkasi, eslatmalar) preview va kutish vaqtiga kirmaydi. | `fn_message_is_hidden`, `hiddenMessages.ts` |
| Arxivlangan ("Yopilgan") suhbatga odam yozsa u **o'zi** qaytadi (`trg_reactivate_thread_on_incoming`); xodim "Qayta ochish" tugmasi bilan ham qaytara oladi. | migr. `20261031100000` |
| Sarlavhada `@username` faqat odamning o'zida bo'lsa (`message_threads.handle`, odamning kiruvchi xabarlaridan); raqamli chat id hech qachon "@" bilan ko'rsatilmaydi. | `channelHandle` |
| Yuborish xatosi operatorga o'zbekcha tushuntirish bilan ko'rinadi (PEER_FLOOD, 24 soat oynasi, …); xom matn tooltip'da. | `deliveryErrors.ts` |
| Sana: o'zbek tilida oy nomlari o'zimizniki ("9 iyn"), brauzerning "M06" emas. | `formatDayMonth` |

## Ichki eslatma

`messages` qatori: `direction='outgoing'`, `message_type='note'`, `metadata.internal=true`.
Eslatma kanalga ketmaydi, suhbatni tepaga ko'tarmaydi (`bump_thread_last_message`),
o'qilmaganlarni tozalamaydi (`mark_answered_on_outgoing`), preview'da chiqmaydi.

## Avto-javob o'qilmaganni tozalamaydi

`mark_answered_on_outgoing` endi faqat odam yozgan javobda `unread → read` qiladi.
Ilgari kechasi ketgan avto-javob ertalabgacha badge'ni o'chirib qo'yardi.

## Operator oqimi (migr. `20261031110000`)

| Narsa | Qayerda |
|---|---|
| Yangi kiruvchi xabarda ovoz + (sahifa fonda yoki boshqa bo'limda bo'lsa) brauzer bildirishnomasi; sarlavhada "(N)"; sidebar'dagi "Xabarlar" yonida kutayotganlar soni. `MessagesProvider` butun CRM'ni o'raydi. | `InboxAlerts.tsx`, `inboxCounts.ts`, `CRMSidebar.tsx` |
| Ovoz / bildirishnoma kaliti — har brauzerda (localStorage `hanguk-inbox-alerts`). | `InboxAlertControls.tsx` |
| O'ng panel: talaba bo'lmasa lid kartasi (telefon, holat, manba, mas'ul, izohlar, "Lid profili"); lid ham bo'lmasa "Lid yaratish" (`create_lead_from_thread` — chatdagi raqam bilan). | `LeadContextCard.tsx` |
| Lid profilida "Chatni ochish" → `/crm/messages?thread=<id>` (`lead_threads`). | `LeadProfileContent.tsx` |
| Qidiruv: lokal (ism, @username, preview) + server `search_threads` (lid/talaba ismi va telefoni — oxirgi 4+ raqam, xabar matni), **barcha tablar bo'ylab**. | `useThreadSearch.ts` |
| Tayyor javoblar `saved_replies` jadvalida; Sozlamalar → Tayyor javoblar (owner/admin tahrirlaydi). `{{ism}}` → mijozning ismi. "/do" yozilsa ro'yxat torayadi, bitta qolsa Enter qo'yadi. | `useSavedReplies.ts`, `SavedRepliesSettings.tsx` |
| Birinchi javob bergan **ma'lum** xodim suhbatga avtomatik biriktiriladi (`trg_assign_thread_on_reply`). Umumiy akkauntdan telefondan yozilgan javobda odam noma'lum — xabar ostida "telefondan" yoziladi. | migr., `useThreadMessages.ts` |
| Tarjima: `translate-message` Cerebras → Groq (Hanguk AI kalitlari), Anthropic faqat zaxira. "Tarjima qilish" faqat xabar interfeys tilidan boshqa tilda bo'lsa chiqadi; natija interfeys tiliga. | `translate-message/index.ts`, `detectLanguage.ts` |
| Suhbat almashganda yozilayotgan matn tozalanadi (avval boshqa odamga ketib qolishi mumkin edi). | `ThreadPane.tsx` (`key`) |

## Kanal va mobil (migr. `20261031120000`)

- Telegram: `PEER_FLOOD` / `FLOOD_WAIT` qayta urinilmaydi (`complete_telegram_outbox(p_final)`), shu aylanishda boshqa yuborishlar to'xtaydi; yuborishlar orasida 1,5 s. Operatorga "telefondan yozing, @SpamBot'ni tekshiring".
- Telegram xizmat akkaunti (777000 — kirish kodlari) CRM'ga yozilmaydi.
- Instagram 24 soat oynasi: CRM'dan yuborib bo'lmaydi (Meta qoidasi). `HUMAN_AGENT` tegi uchun Meta app review kerak — tekshirilmagan API'ga taxmin bilan kod yozilmadi.
- Telefon/planshet (<1024 px): bitta panel — ro'yxat yoki suhbat (orqaga tugmasi bilan). Ro'yxat 120 tadan ko'rsatiladi ("Yana N ta").
