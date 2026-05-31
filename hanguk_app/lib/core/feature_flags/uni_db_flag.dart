/// Feature flag for the University DB system (plan §H).
///
/// Default flipped to `true` on 2026-05-10 once Phase 3 migrations + the
/// seed data + the in-office reviewer role landed on prod.
///
/// All four conditions for safe-to-default-true now hold:
///   1. Phase 0/1/2/3 migrations applied to staging + prod (34 + 4 sync
///      migrations on prod, all in supabase_migrations.schema_migrations).
///   2. Seed rows present in announcement_sources (top-30) and
///      term_glossary (initial seed).
///   3. Phase 1 legacy_compat view in place for universities reads.
///   4. Edge Functions (get-pdf-url, register-push-token,
///      notify-tracked-changes) deployed to both projects.
///
/// Routes that require a specific role (e.g. /admin/review needs
/// uni_db_reviewer or uni_db_admin) handle that internally with their
/// own forbidden scaffold — flag-on doesn't grant access, only
/// exposure of the route.
///
/// Compile-time override: `--dart-define=UNI_DB_ENABLED=false` to
/// disable in a specific build (e.g. for an emergency hotfix that
/// needs to revert UI exposure without redeploying the database).
const bool kUniDbEnabled = bool.fromEnvironment(
  'UNI_DB_ENABLED',
  defaultValue: true,
);
