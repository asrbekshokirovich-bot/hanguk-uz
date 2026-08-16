# ZumSavdo

Uzum Market boʻyicha kunlik oʻlchovlarga asoslangan analitika paneli.
`design/wireframe.html` dagi wireframe asosida qurilgan.

## Ishga tushirish

```bash
cd zumsavdo
npm install
npm run dev      # http://localhost:5180
```

Boshqa buyruqlar:

```bash
npm run build      # ishlab chiqarish uchun yigʻish (dist/)
npm run preview    # yigʻilgan versiyani koʻrish
npm run typecheck  # TypeScript tekshiruvi
```

## Manzillar

Har bir sahifa **id** boʻyicha ochiladi — nomga bogʻlanmaydi, chunki Uzumda nom
istalgan kuni oʻzgarishi mumkin, id esa yoʻq.

| Manzil | Sahifa |
|---|---|
| `/` | Bosh sahifa — butun bozor |
| `/sotuvchi/9127` | Sotuvchi |
| `/mahsulot/560816` | Mahsulot |
| `/turkum/1021` | Turkum |

Tanlangan davr URL da saqlanadi (`?davr=30d`, `?davr=custom&dan=…&gacha=…`),
shuning uchun sahifalar orasida oʻtganda u yoʻqolmaydi.

## Asosiy qoida — aniq va taxminiy

Panel hech qachon hisoblab chiqarilgan raqamni oʻlchangan raqam kabi
koʻrsatmaydi. Har bir raqam yonida belgisi bor:

| Raqam | Toifa | Manba |
|---|---|---|
| Buyurtmalar | **aniq** | `Shop.ordersQuantity` hisoblagichining farqi |
| Xaridorlar / hafta | **aniq** | `MotivationAction.text` — "Bu haftada N kishi sotib oldi" |
| Oʻrin | **aniq** | kuzatilayotgan obyektlar orasidagi saralash |
| Aylanma | taxminiy | dona × narx |
| Sotuv (dona) | taxminiy | qoldiq kamayishidan |
| Raqobat | taxminiy | buyurtma ÷ kuzatilayotgan mahsulot soni |

Taxminiy raqam oldiga `~` qoʻyiladi.

Boshqa qatʻiy qoidalar:

- **Maʻlumot 28.07.2026 dan boshlanadi.** Undan oldingi sanalar tanlanmaydi —
  aks holda "nol buyurtma" degan yolgʻon javob chiqadi.
- **"Bugun" toʻliq kun emas.** Nechta sweep tushgani yozib qoʻyiladi (masalan
  `7/12 oʻlchov tushgan`), aks holda tushmagan yarim kun pasayish deb oʻqiladi.
- **Oʻrin uch narsasiz koʻrsatilmaydi:** nima boʻyicha, kimlar orasida, qaysi
  davrda. Oʻsish/tushish strelkasi yoʻq — taqqoslash uchun ikkinchi oʻlchov
  yigʻilmagan.
- **Xaridorlar / hafta doim 7 kunlik.** Davr tugmasi buni oʻzgartirmaydi,
  chunki manba shunday.
- **"Nima oʻzgardi" sabab daʻvo qilmaydi.** Faqat bir vaqtda nima boʻlgani
  yoziladi; bogʻliqligini sotuvchining oʻzi baholaydi.
- **Kam sotuvchi kuzatilgan turkumda xulosa chiqarilmaydi** — top-5 ulushi
  100% ga yaqin chiqib, "kirish qiyin" degan notoʻgʻri javob beradi.
- **Qidiruv normalizatsiya bilan.** Lotin va kirill, apostrofning toʻrt xil
  koʻrinishi (`ʻ ʼ ' ` `) solishtirishdan oldin bitta shaklga keltiriladi.

## Tuzilma

```
src/
  data/
    types.ts      maʻlumot modeli — Metric aniq/taxminiy toifani tashiydi
    dataset.ts    namuna toʻplami (seed boʻyicha barqaror) + hodisa aniqlash
    api.ts        soʻrov qatlami — sahifalar faqat shuni biladi
  lib/
    dates.ts      sanalar, DATA_START
    period.ts     davr mantiqi, oʻrin oynasi
    usePeriod.ts  davrni URL da saqlash
    normalize.ts  lotin/kirill + apostrof normalizatsiyasi
    format.ts     raqam va pul formatlari
  components/
    Chart.tsx     chiziqli grafik: krossxair, tooltip, soya, jadval koʻrinishi
    ...
  pages/          Home, Shop, Product, Category, NotFound
```

## Maʻlumot manbai

Hozircha `src/data/dataset.ts` seed boʻyicha barqaror namuna toʻplamini
yaratadi: 2026-07-28 dan bugungacha, ~60 sotuvchi, ~400 mahsulot, 10 turkum.
Toʻplam taxminiy oʻlchovning zaifligini ataylab saqlaydi — tovar oraliqda
keltirilgan kunlarda sotuvning bir qismi koʻrinmay qoladi, chunki interfeys
buni koʻrsatishi kerak.

Uzumni sweep qiluvchi haqiqiy backend ulanganda faqat `src/data/api.ts`
HTTP chaqiruvlariga aylantiriladi — sahifalar va komponentlar tegilmaydi.
`types.ts` dagi maydonlar oʻsha manbaning nomlariga qarab tanlangan
(`Shop.ordersQuantity`, `MotivationAction.text`).
