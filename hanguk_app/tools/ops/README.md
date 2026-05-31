# tools/ops/

Operational Dart scripts that connect to the **production Supabase
project**. Run with care.

## Scripts

| script | purpose | env vars required |
| --- | --- | --- |
| `auto_deploy.dart` | Build APK + upload to `app-updates/` Supabase Storage bucket + insert a row into `app_versions`. Used by the bundled in-app auto-updater. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `deploy_update.dart` | Manual variant of `auto_deploy.dart` — same flow, different CLI. | same |
| `setup_bucket.dart` | One-off: create the `app-updates` and `legal` Supabase Storage buckets with the correct public/private flags. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

## Warnings

1. These scripts use the **service-role key**, which bypasses RLS.
   Never check the key into source.
2. They are intended for the founder / release manager only. Do not
   run them from CI without a vault-backed secret store.
3. `auto_deploy.dart` is **incompatible with the Play Store build**
   path (P2 #48 will replace it with Play In-App Updates). Use it
   only for direct-APK distribution.

## Invocation

```bash
export SUPABASE_URL=https://...supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...   # NEVER COMMIT
dart run tools/ops/setup_bucket.dart       # one-time, idempotent
dart run tools/ops/auto_deploy.dart        # per-release
```
