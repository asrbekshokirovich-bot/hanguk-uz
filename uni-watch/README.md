# uni-watch — Koreya universitetlari qabul e'lonlari kuzatuvchisi

**Nima qiladi:** har soatda 408 ta Janubiy Koreya universitetining qabul
sahifasini tekshiradi. Yangi e'lon (모집요강 / qabul boshlanishi) chiqsa —
Telegram'ga xabar yuboradi.

Bu tizim **mustaqil**. Ishlashi uchun kerak bo'lgan narsa: bitta Telegram bot.
Ma'lumotlar bazasi yo'q, pullik xizmat yo'q, server yo'q, hech qanday API kalit
yo'q. Ishga tushirib qo'yasiz — o'zi ishlayveradi.

---

## Xabar shunday keladi

```
🎓 Yangi qabul e'loni: 2 ta

🏛 가톨릭관동대학교 (Catholic Kwandong University)
   • 정시 2027학년도 정시 모집요강 2026.08.31
     https://ipsi.cku.ac.kr/bbs/iphak/1059/367071/artclView.do
   • 재외국민 2027학년도 재외국민과 외국인 특별전형 최종 합격자 발표
     https://ipsi.cku.ac.kr/bbs/iphak/1059/366981/artclView.do
```

Havola — universitetning o'z sahifasi, bir bosishda ochiladi.

---

## Sozlash — 3 qadam, ~10 daqiqa

Kod yozish shart emas. Hammasi brauzerda.

### 1-qadam. Telegram bot yasang

1. Telegram'da **@BotFather** ni oching.
2. `/newbot` deb yozing.
3. Nom bering — masalan `Koreya Qabul Xabarchi`.
4. Username bering — masalan `koreya_qabul_bot` (oxiri `bot` bo'lishi shart).
5. BotFather **token** beradi: `123456789:AAH...` ko'rinishida. Nusxa oling.

> Tokenni hech kimga bermang. U — botingizning kaliti.

### 2-qadam. Chat ID raqamingizni oling

1. Yangi botingizni oching va **`/start`** bosing.
   *(Bu majburiy — Telegram botga o'zi birinchi yozishga ruxsat bermaydi.)*
2. Brauzerda shu manzilni oching (`<TOKEN>` o'rniga o'z tokeningizni qo'ying):

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

3. Chiqqan matndan `"chat":{"id":123456789` ni toping.
   **`123456789`** — sizning raqamingiz.

### 3-qadam. Ikkalasini GitHub'ga saqlang

1. Repozitoriyani oching → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**.
2. Ikkitasini alohida qo'shing:

   | Name (aynan shunday) | Secret |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | 1-qadamdagi token |
   | `TELEGRAM_CHAT_ID` | 2-qadamdagi raqam |

**Tamom.** Har soat boshida tizim o'zi tekshiradi.

---

## Sinab ko'rish

**Actions** → **uni-watch — qabul e'lonlarini kuzatish** → **Run workflow**.

Sinov uchun `limit` katagiga `20` yozing — 20 ta universitetni tekshiradi,
tez tugaydi.

Natijani yurish ichidan o'qiysiz:

```
Tekshirildi: 20, yangi e'lon: 0, ochilmadi: 6
```

- **yangi e'lon: 0** — yangilik yo'q. Normal holat.
- **ochilmadi: 6** — o'sha 6 ta sayt javob bermadi. Bu ham normal, pastga qarang.

> **Birinchi yurish har doim `yangi e'lon: 0` beradi.** Bu xato emas: tizim
> avval hozirgi e'lonlarni eslab oladi, keyin faqat **yangi** qo'shilganini
> aytadi. Aks holda birinchi xabar 5000 ta eski e'lon bilan kelardi.

---

## Tez-tez beriladigan savollar

**"ochilmadi" degani nima? Xatoligimi?**

Yo'q. Koreya universitet saytlarining bir qismi tashqaridan kirishni bloklaydi,
bir qismi manzilini o'zgartirgan, bir qismi shunchaki ishlamayapti. Tizim
ularni o'tkazib yuboradi va qolganini tekshiraveradi. **Bitta sayt ishlamagani
qolgan 407 tasiga ta'sir qilmaydi** — shunday qilib yozilgan.

**Universitet qo'shsam/o'chirsam bo'ladimi?**

Ha. `universities.csv` faylini GitHub'da ochib, qalam belgisini bosib
tahrirlang. Har qator: `name_ko,name_en,url`. Yangi qo'shilgan universitetning
mavjud e'lonlari xabar qilinmaydi — faqat undan keyingi yangiliklari.

**Bir xil xabar ikki marta kelmaydimi?**

Kelmaydi. Aytilgan har bir e'lon `state.json` fayliga yozib boriladi.
Xabar **avval yuboriladi, keyin** yoziladi — ya'ni uzilish bo'lsa eng yomoni
bitta xabar takrorlanadi, e'lon esa hech qachon yo'qolmaydi.

**Qancha turadi?**

Hech narsa. GitHub Actions bepul, Telegram bepul, hech qanday pullik xizmat
ishlatilmaydi.

**Har soat ko'pmi yoki kammi?**

Har soat — yetarli. Universitetlar e'lonni yiliga bir necha marta chiqaradi,
shuning uchun bir soat kechikish sezilmaydi. Kamroq xohlasangiz
`.github/workflows/uni-watch.yml` faylidagi `cron: "0 * * * *"` ni
`"0 */3 * * *"` (3 soatda bir) qilib o'zgartiring.

---

## Ichida nima bor

| Fayl | Nima |
|---|---|
| `universities.csv` | 408 ta universitet ro'yxati. Tahrirlash mumkin. |
| `watch.py` | Butun dastur. Bitta fayl. |
| `state.json` | Qaysi e'lon aytilganining ro'yxati. Tizim o'zi yozadi. |
| `test_watch.py` | 31 ta tekshiruv. |
| `requirements.txt` | 2 ta kutubxona. |

## Dasturchi uchun

```bash
cd uni-watch
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt pytest

python watch.py --limit 20 --dry-run   # sinov: yubormaydi, ko'rsatadi
python -m pytest test_watch.py -q      # testlar
```

E'lon deb nimani hisoblash `watch.py` ichidagi `is_admission_link()` va
`looks_specific()` da belgilangan: `모집요강` turkumidagi kalit so'z, yoki
(chet ellik talabaga oid so'z + qabul so'zi) — va sarlavha menyu tugmasi emas,
haqiqiy e'longa o'xshashi kerak (yil raqami bor yoki ≥12 belgi).

Korporativ proksi ortida ishlatsangiz `SSL_CERT_FILE` ni sertifikat fayliga
yo'naltiring — dastur uni o'qiydi.
