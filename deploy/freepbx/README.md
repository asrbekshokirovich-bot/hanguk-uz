# FreePBX → HANGUK CRM

Uch qism: hodisalar, yozuvlar, sozlama.

## 1. Sozlama fayli

`/etc/hanguk/crm.conf` (faqat root o'qiydi: `chmod 600`):

    CRM_URL=https://lysjdtyanhdfphqyijsr.supabase.co
    ASTERISK_WEBHOOK_SECRET=<Supabase secretidagi bilan bir xil>
    SUPABASE_SECRET_KEY=sb_secret_...

`SUPABASE_SECRET_KEY` — bu **secret key**, service-role JWT emas. Ofis serveri
buzilsa, bu kalitni alohida bekor qilish mumkin va CRM'ning qolgan qismi
ishlashda davom etadi.

## 2. Hodisalar — `extensions_custom.conf`

    [hanguk-hooks](macro)
    exten => s,1,System(/usr/local/bin/hanguk-call-event.sh start ${UNIQUEID} ${CALLERID(num)} ${EXTEN} outgoing)
     same => n,MacroExit()

Amalda uchta nuqtaga ulanadi:

- qo'ng'iroq boshlanishi → `start`
- `AnswerHook` yoki `A()` opsiyasi → `answer`
- `hangup_handler_push` → `hangup`, `hangupcause` va `billsec` bilan:

      exten => h,1,System(/usr/local/bin/hanguk-call-event.sh hangup ${UNIQUEID} ${CHANNEL(peername)} ${CALLERID(num)} ${DIRECTION} '{"hangupcause":${HANGUPCAUSE},"duration":${CDR(billsec)}}')

`billsec` — suhbat vaqti. `duration` emas: u jiringlashni ham qo'shadi va
statistikani shishiradi.

## 3. Yozuvlar

Yozuv fayli tugagach `MixMonitor` uni navbat papkasiga qo'yadi:

    exten => s,n,MixMonitor(${UNIQUEID}.wav,b,/bin/mv /var/spool/asterisk/monitor/${UNIQUEID}.wav /var/spool/hanguk/pending/)

Keyin cron har 10 daqiqada:

    */10 * * * * root /usr/local/bin/hanguk-upload-recordings.sh

Yuklanmagan fayl navbatda qoladi va keyingi yurishda qayta urinadi. 30 marta
muvaffaqiyatsizdan keyin `/var/spool/hanguk/failed/` ga o'tadi — o'chirilmaydi.

## Sinov tartibi

1. `hanguk-call-event.sh start TEST-1 1001 998901112233 outgoing` — CRM'da
   `calls` qatori paydo bo'lishi kerak
2. `answer`, keyin `hangup` (`hangupcause=16`) — status `completed`, `answered_at`
   to'ldirilgan
3. Yozuv faylini `pending/` ga qo'yib skriptni qo'lda ishga tushiring
