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

## Maʻlumot oqimi

```
manba  →  xom oʻlchov  →  kunlik yigʻindi  →  panel
          (observation)   (bazada, SQL)      (faqat oʻqiydi)
```

Kunlik raqam **hech qachon** manbadan toʻgʻridan-toʻgʻri olinmaydi. Uzum
buyurtmani kümülativ hisoblagich sifatida beradi (`Shop.ordersQuantity`), kunlik
son esa ikki oʻlchov farqi. Farq bazada hisoblanadi — bitta joyda, bitta
qoida bilan.

Shu ajratishning natijasi: kun chegarasidagi oʻlchov tushmagan boʻlsa,
buyurtma `null` boʻlib qoladi va panel uni yigʻindiga qoʻshmaydi hamda nechta
kun tushib qolganini yozadi. Bunday kunga nol yozish "sotuv boʻlmagan" degan
yolgʻon javob beradi.

Sotuv (dona) esa qoldiqning **ketma-ket oʻlchovlar orasidagi pasayishlari**
yigʻindisi. Kun ichida bir necha marta oʻlchash shuning uchun muhim: kunlik
yagona farq olinsa, oraliqda keltirilgan tovar sotuvni butunlay yashiradi.

## Ombor (Supabase)

Jadvallar `zumsavdo` sxemasida; panel ularni `public.zs_*` koʻrinishlari orqali
oʻqiydi, yozuvchi esa `public.zs_ingest_batch` funksiyasi orqali yozadi.

| Jadval | Nima |
|---|---|
| `category`, `shop`, `product` | lugʻatlar |
| `sweep` | bitta yigʻish sessiyasi: qamrov, xato soni |
| `shop_observation` | kümülativ hisoblagichning bir ondagi holati |
| `product_observation` | narx, qoldiq, sharh, haftalik xaridor |
| `shop_day`, `product_day` | kunlik yigʻindi (`rollup_days` hisoblaydi) |

Panelga faqat oʻqish kaliti beriladi (`VITE_SUPABASE_ANON_KEY`) — yozish huquqi
yoʻq. Service role kaliti faqat `ingest/.env` da qoladi va brauzerga tushmaydi.

Ombor sozlanmagan boʻlsa panel namuna toʻplami bilan ochiladi va yuqorida
**"Bu namuna maʻlumot"** ogohlantirishi turadi — namuna raqami hech qachon
haqiqiy oʻlchov kabi koʻrinmasligi kerak.

## Yigʻuvchi (`ingest/`)

```bash
cd zumsavdo/ingest
npm install
cp .env.example .env      # toʻldiring
npm run sweep             # oʻlchov oling va kunlik yigʻindini yangilang
npm run sweep -- --probe  # manba javobini oʻzgartirmasdan bosib chiqaradi
npm run rollup            # faqat qayta hisoblash
```

Manbalar `ZUMSAVDO_SOURCE` bilan tanlanadi:

- **`sample`** — namuna oʻlchovlari. Kredensialsiz ham butun quvurni (sxema,
  farq hisobi, aniq/taxminiy ajratmasi) tekshirib koʻrish uchun.
- **`uzum-catalog`** — Uzum katalogi. Ruxsat talab qiladi, pastga qarang.

### Uzum katalogiga kirish — hozircha yopiq

`graphql.uzum.uz` brauzerdan kelmagan soʻrovni chekkasidayoq rad etadi:

```
HTTP/2 401
x-ext-authz-check-result: denied
```

Yigʻuvchi bu himoyani aylanib oʻtishga urinmaydi — rad javobi kelsa sweep
darhol toʻxtaydi va sababi yoziladi. Kirish huquqi Uzumdan **rasmiy** olinishi
va `UZUM_CATALOG_HEADERS` ga qoʻyilishi kerak.

`sources/catalog-queries.mjs` dagi GraphQL soʻrovlari jonli sxemaga qarshi
tekshirilmagan (tekshirishning imkoni boʻlmadi). Ruxsat olingach
`npm run sweep -- --probe` javobni toʻliq bosib chiqaradi va maydon nomlarini
oʻsha bitta faylda tuzatish kifoya.

### Oʻz doʻkoningiz uchun rasmiy yoʻl

`api-seller.uzum.uz` — Uzumning sotuvchilar uchun rasmiy API'si; token
`seller.uzum.uz` kabinetida olinadi. U butun bozorni emas, **oʻz doʻkoningiz**
maʻlumotini beradi (buyurtma, mahsulot, narx, qoldiq) va katalogdan farqli
oʻlaroq captcha bilan yopilmagan.
