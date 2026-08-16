# Ombor migratsiyalari

Bu papkadagi fayllar Supabase loyihasiga qoʻllangan migratsiyalarning nusxasi —
sxema faqat bazada emas, omborda ham versiyalangan boʻlishi uchun.

Tartib bilan qoʻllanadi:

| Fayl | Nima qiladi |
|---|---|
| `20260816102505_zumsavdo_core_schema.sql` | `zumsavdo` sxemasi: lugʻatlar, sweep, xom oʻlchov, kunlik yigʻindi, RLS |
| `20260816102710_zumsavdo_rollup_functions.sql` | xom oʻlchovdan kunlik yigʻindi hisoblash |
| `20260816102855_zumsavdo_public_api.sql` | `public.zs_*` koʻrinishlari va yozish funksiyalari |
| `20260816104821_zumsavdo_expected_sweeps_from_cadence.sql` | kutilayotgan oʻlchov sonini haqiqiy ritmdan olish |

Supabase CLI bilan:

```bash
supabase link --project-ref <ref>
supabase db push
```
