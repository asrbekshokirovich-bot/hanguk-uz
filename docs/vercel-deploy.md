# Vercel: nima qachon deploy bo'ladi

Bepul tarifda **kuniga 100 ta deploy** (butun akkaunt bo'yicha: sayt + `hanguk-ilova`).
2026-11-10/11 da limit tugab, `main`ning prod deploy'i ikki marta («Deployment rate
limited») va veb ilova deploy'i besh marta yiqildi — sabab: har bir branch'ga har bir
push sayt uchun preview yig'ardi (10-noyabrda 87 preview, 18 production).

Shuning uchun `vercel.json`:

```json
"git": { "deploymentEnabled": { "main": true, "**": false } }
```

- `main` — har doim prod'ga chiqadi (o'zgarmadi).
- Boshqa hamma branch — Vercel deploy yaratmaydi (preview yo'q). Qoida branch'ning
  o'zidagi `vercel.json`dan o'qiladi: bu o'zgarishdan oldin ochilgan branch'lar
  `main`ni o'ziga qo'shib olmaguncha preview yig'ishda davom etadi.
- Preview kerak bo'lsa: shu branch'da `vercel.json`ga `"<branch-nomi>": true`
  qo'shing (kamida bitta qoida `true` bo'lsa deploy bo'ladi) yoki lokal `npm run build && npm run preview`.

Veb ilova (`hanguk.uz/ilova`) — `.github/workflows/web-app-vercel.yml`, `main`ga push'da
va qo'lda (Run workflow). Limit tugagan bo'lsa run xulosasida «Veb ilova deploy
QILINMADI» deb yoziladi; limit ochilgach qo'lda qayta ishga tushiriladi.

Manba: <https://vercel.com/docs/project-configuration/git-configuration>
