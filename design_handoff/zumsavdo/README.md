# ZumSavdo — panel dizayni

Bu papka **hanguk-uz** ilovasining bir qismi emas. ZumSavdo (Uzum bozori analitikasi)
alohida loyiha; dizayn shu repositoriyda faqat saqlanadi.

| Fayl | Nima |
| --- | --- |
| `wireframe.html` | Boshlangʻich wireframe: raqamlangan qutilar + har biri nimaligi yozilgan roʻyxat |
| `panel.html` | Wireframe asosida tayyorlangan dizayn — toʻrtta ekran, hech qanday maʻlumotsiz |

## `panel.html` haqida

Toʻrtta ekran yuqoridagi tablar orqali almashadi: **Bosh sahifa · Sotuvchi · Mahsulot · Turkum**.
Barcha raqam va nomlar boʻsh: kulrang blok — maʻlumot tushadigan joy, `—` — hali qiymat yoʻq,
grafiklar oʻrnida boʻsh oʻq va «Maʻlumot yoʻq» holati.

Dizaynga kiritilgan qoidalar (wireframe’dagi izohlardan):

- Har bir raqam **aniqlik chipi** bilan yuradi — `ANIQ` (Uzum bergan raqam) yoki
  `~ TAXMINIY` (biz hisoblagan raqam, oldida `~`).
- Oʻrin raqamida oʻsish/tushish strelkasi yoʻq — ikkinchi oʻlchov yigʻilmagan.
- «Nima oʻzgardi» roʻyxati sabab koʻrsatmaydi, faqat bir vaqtda nima boʻlganini yozadi.
- Mahsulot sahifasidagi toʻrt grafik bitta vaqt oʻqiga tik joylashadi.

## Texnik

Bitta mustaqil HTML fayl — tashqi shrift, skript yoki stil yuklanmaydi.
Light va dark rejim CSS token’lari orqali: sistema temasi ham, aniq tanlangan tema ham qoʻllanadi.
Brauzerda ochish kifoya, build kerak emas.
