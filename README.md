# Hanguk Consulting

Janubiy Koreya universitetlariga ariza berish platformasi — o'quvchi portali va
ichki CRM (leadlar, arizalar, hujjatlar, suhbatga tayyorgarlik).

Texnologiyalar: **Vite · React 18 · TypeScript · Tailwind · shadcn-ui · Supabase**

---

## Local serverda ishga tushirish

### 1. Talablar
- **Node.js 20+** va npm ([nvm](https://github.com/nvm-sh/nvm#installing-and-updating) orqali o'rnatish qulay)
- Git

Tekshirish:
```sh
node -v   # v20 yoki undan yuqori
npm -v
```

### 2. Kodni olish va paketlarni o'rnatish
```sh
git clone <REPO_URL>
cd hanguk-uz
npm install
```

### 3. Muhit o'zgaruvchilari
Loyihada ishlaydigan `.env` allaqachon bor. Agar o'zingizning Supabase
loyihangizga ulanmoqchi bo'lsangiz:
```sh
cp .env.example .env
```
va qiymatlarni Supabase panelidagi **Project Settings → API** dan to'ldiring.

`.env` bo'lmasa yoki `VITE_SUPABASE_URL` bo'sh bo'lsa, ilova brauzerda oq ekran
bilan ochiladi va konsolda `supabaseUrl is required` xatosi chiqadi.

### 4. Ishga tushirish
```sh
npm run dev
```
Brauzerda oching: **http://localhost:8080**

Kod o'zgarganda sahifa avtomatik yangilanadi (HMR).

---

## Buyruqlar

| Buyruq | Nima qiladi |
|---|---|
| `npm run dev` | Dev server, http://localhost:8080 |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | `dist/` ni local serverda ochish (build'ni tekshirish uchun) |
| `npm test` | Testlarni bir marta ishga tushirish (Vitest) |
| `npm run test:watch` | Testlarni kuzatuv rejimida |
| `npm run lint` | ESLint |
| `npm run design` | Lead moduli dizayn preview'i, http://localhost:8099 |

### Portni o'zgartirish
8080 band bo'lsa, `.env` ga qo'shing:
```sh
VITE_DEV_PORT=5173
```
Server standart holatda `0.0.0.0` da tinglaydi — ya'ni bir tarmoqdagi
telefondan ham `http://<kompyuter-IP>:8080` orqali ochsa bo'ladi. Faqat
o'zingizga ochiq bo'lishi uchun `VITE_DEV_HOST=127.0.0.1` qo'ying.

---

## Muammolar

### `npm install` `sharp` da to'xtaydi

```
npm error path ...\node_modules\sharp
npm error sharp: Installation error: aborted
```

`sharp` — bu app ikonkalarini yasaydigan `@capacitor/assets` ning ichki paketi.
U o'rnatishda GitHub'dan binar fayl yuklaydi, sekin internetda uzilib qoladi.
Ilovani ishga tushirish uchun u **kerak emas**, shuning uchun u
`optionalDependencies` ga o'tkazilgan — endi u yiqilsa ham `npm install`
davom etadi.

Baribir to'xtasa:
```sh
npm install --ignore-scripts
```

### `'vite' is not recognized`

`npm install` oxirigacha yetmagan — node_modules to'liq emas. Yuqoridagi
buyruq bilan qayta o'rnating.

### Port band (`EADDRINUSE`)

`.env` ga boshqa port yozing: `VITE_DEV_PORT=5173`

---

## Lead moduli dizayni

Dizayn manbasi `lead_module_design/` papkasida (Design Code eksporti).
Ko'rish uchun:

```sh
npm run design
```
So'ng **http://localhost:8099/Lead-Module-Preview.dc.html** ni oching.

> Preview React'ni CDN'dan (unpkg.com) yuklaydi, shuning uchun **birinchi
> ochishda internet kerak**. Internetsiz sahifa bo'sh qoladi va konsolda
> `failed to load ... react.production.min.js` chiqadi.

Dizayn amaldagi ilovaga allaqachon ko'chirilgan — kod
`src/components/crm/leads/intake/` da. Batafsil: `lead_module_design/README.md`.

---

## Loyiha tuzilishi

```
src/
  components/crm/       # CRM: leadlar, arizalar, hujjatlar
  components/student/   # O'quvchi portali
  contexts/             # React kontekstlari (auth, leads, ...)
  integrations/supabase/# Supabase klienti va tiplari (avtomatik generatsiya)
  pages/                # Route sahifalari
supabase/migrations/    # Ma'lumotlar bazasi migratsiyalari
lead_module_design/     # Lead moduli dizayn paketi (manba, kod emas)
hanguk_app/             # Flutter mobil ilova (alohida loyiha)
scripts/                # Yordamchi skriptlar
```

Asosiy route'lar: `/` (landing), `/auth` (kirish), `/portal` (o'quvchi),
`/crm/*` (ichki CRM — kirish talab qilinadi).

---

## Testlar

```sh
npm test
```
Testlar `src/**/*.test.tsx` shaklida, komponent yonidagi `__tests__/`
papkalarida turadi. Vitest + Testing Library, muhit: jsdom.

---

## Mobil ilova (Capacitor)

```sh
npm run build
npx cap sync
npx cap open android   # yoki ios
```

`hanguk_app/` — alohida Flutter loyihasi, o'z README'si bilan.

---

## Deploy

- Web: Vercel (`vercel.json` mavjud)
- Do'konlar: `STORE_DEPLOYMENT.md`, `STORE_METADATA.md`
