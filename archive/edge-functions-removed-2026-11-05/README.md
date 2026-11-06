# O'chirilgan edge funksiyalar arxivi (2026-11-05)

## Nima uchun
2026-11-05 xavfsizlik auditida Supabase loyihasidagi (`lysjdtyanhdfphqyijsr`) quyidagi 31 ta edge funksiya o'chirildi:

- ko'pchiligi autentifikatsiyasiz (`verify_jwt = false`) va service-role kalit bilan bazaga yozar/o'qir edi;
- oxirgi 7 kunda ularga 0 ta chaqiruv bo'lgan (ishlatilmaydi);
- `orbit-sync` 2026-11-03 da to'xtatilgan (Orbit o'z loyihasiga ko'chgan);
- bir qismi allaqachon "gone" stub edi — endi hammasi bir xil stubga keltirildi.

Asrbek (owner) ruxsati bilan har biri o'rniga **410 Gone** qaytaradigan stub deploy qilindi (`verify_jwt = true`):

```ts
Deno.serve(() =>
  new Response(JSON.stringify({ error: "gone" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  }),
);
```

Bu papkada har bir funksiyaning o'chirilishdan oldingi **jonli (live) kodi** aynan saqlangan (`get_edge_function` natijasidan). Fayllarda maxfiy kalit topilmadi, hech narsa `<REDACTED>` qilinmadi.

## Funksiyalar (asl versiya va verify_jwt)

| Funksiya | Asl versiya | Asl verify_jwt | Entrypoint (asl) | Fayllar (shu papkada) |
|---|---|---|---|---|
| `analyze-application-form` | 70 | false | `source/index.ts` | `index.ts` |
| `backfill-uz` | 40 | true | `source/index.ts` | `index.ts` |
| `check-search-job` | 69 | false | `source/supabase/functions/check-search-job/index.ts` | `check-search-job/index.ts` |
| `code-proxy` | 40 | false | `source/index.ts` | `index.ts` |
| `crawl-dispatcher` | 44 | true | `source/index.ts` | `source/index.ts`, `_shared/cors.ts` |
| `crawl-worker` | 45 | true | `source/index.ts` | `source/index.ts`, `_shared/cors.ts` |
| `diagtranslate` | 57 | true | `source/index.ts` | `index.ts` |
| `discover-university-websites` | 70 | false | `source/index.ts` | `index.ts`, `extract-universities.ts` |
| `embed-content` | 44 | false | `source/embed-content/index.ts` | `embed-content/index.ts`, `_shared/gemini.ts` |
| `find-application-form` | 69 | false | `source/supabase/functions/find-application-form/index.ts` | `find-application-form/index.ts` |
| `find-faculty-forms` | 70 | false | `source/index.ts` | `index.ts` |
| `import-academyinfo` | 69 | false | `source/supabase/functions/import-academyinfo/index.ts` | `import-academyinfo/index.ts` |
| `import-korean-universities` | 70 | false | `source/index.ts` | `index.ts` |
| `ingest-pdf-ai` | 38 | false | `source/index.ts` | `index.ts` |
| `orbit-app` | 41 | false | `source/supabase/functions/orbit-app/index.ts` | `orbit-app/index.ts` |
| `orbit-ask` | 42 | true | `source/index.ts` | `index.ts` |
| `orbit-read` | 54 | true | `source/index.ts` | `index.ts` |
| `orbit-write` | 45 | true | `source/index.ts` | `index.ts` |
| `orbit-telegram-admin` | 40 | true | `source/index.ts` | `index.ts` |
| `orbit-telegram-webhook` | 54 | false | `source/index.ts` | `index.ts` |
| `orbit-signal` | 41 | false | `source/supabase/functions/orbit-signal/index.ts` | `orbit-signal/index.ts` |
| `orbit-sync` | 41 | false | `source/index.ts` | `index.ts` |
| `process-guideline` | 43 | false | `source/index.ts` | `source/index.ts`, `_shared/cors.ts` |
| `register-user` | 66 | true | `source/supabase/functions/register-user/index.ts` | `register-user/index.ts` |
| `search-university` | 70 | false | `source/index.ts` | `index.ts` |
| `seed-gks-data` | 69 | false | `source/supabase/functions/seed-gks-data/index.ts` | `seed-gks-data/index.ts` |
| `sync-admission-forms` | 69 | false | `source/supabase/functions/sync-admission-forms/index.ts` | `sync-admission-forms/index.ts` |
| `telegram-poll-probe` | 31 | true | `source/index.ts` | `index.ts` |
| `tg-setup-once` | 39 | true | `source/index.ts` | `index.ts` |
| `update-staff-password` | 66 | false | `source/supabase/functions/update-staff-password/index.ts` | `update-staff-password/index.ts` |
| `validate-application-data` | 69 | false | `source/supabase/functions/validate-application-data/index.ts` | `validate-application-data/index.ts` |

Eslatma: `code-proxy`, `diagtranslate`, `orbit-ask`, `orbit-read`, `orbit-write`, `orbit-telegram-admin`, `orbit-telegram-webhook`, `telegram-poll-probe`, `tg-setup-once` o'chirishdan oldin ham "gone" (410) stub edi — ularning asl ishchi kodi bu repo tarixida yo'q, shuning uchun bu yerda faqat o'sha stub saqlangan.

## Qanday tiklash
1. Kerakli funksiya papkasidagi fayllarni `supabase/functions/<nom>/` ga ko'chiring (`_shared/...` fayllarni `supabase/functions/_shared/` ga). Importlar (`../_shared/cors.ts` va h.k.) shu tuzilishga mos.
2. Deploy qiling: `supabase functions deploy <nom> --project-ref lysjdtyanhdfphqyijsr` (asl `verify_jwt = false` bo'lsa `--no-verify-jwt` qo'shing — lekin avval autentifikatsiya qo'shish tavsiya etiladi).
3. Kerakli secretlar (`GEMINI_API_KEY`, `FIRECRAWL_API_KEY`, `DATA_GO_KR_SERVICE_KEY`, `ORBIT_SIGNAL_SECRET` va h.k.) loyihada borligini tekshiring.
