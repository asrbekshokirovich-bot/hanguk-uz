# hanguk_app

A Flutter / Supabase / Riverpod app for Korean-language learners and
visa-track applicants.

## University DB system (Phase 1 — flip-ready scaffolding)

The repository hosts a Python service layer at
[`services/uni_db/`](services/uni_db/) plus matching Supabase migrations
and Flutter routes that together build an always-fresh,
Korean-source-of-truth multilingual database of Korean university
admissions.

- Plan: [`UNIVERSITY_DB_BUILD_PLAN.md`](UNIVERSITY_DB_BUILD_PLAN.md)
- Audit: [`UNIVERSITY_DB_AUDIT.md`](UNIVERSITY_DB_AUDIT.md)
- Service quickstart: [services/uni_db/README.md](services/uni_db/README.md)
- Phase 1 delta: [services/uni_db/PHASE_1_NOTES.md](services/uni_db/PHASE_1_NOTES.md)
- Credentials run-list: [docs/credentials.md](docs/credentials.md)
- Migrations: [supabase/migrations/](supabase/migrations/) — files named
  `20260601000000_uni_db_v1_*.sql` (Phase 0 schema), `20260601000200_*.sql`
  (Phase 0 seeds), and `20260605000*_uni_db_v1_*.sql` (Phase 1 HITL +
  recent-changes view).
- Flutter integration is gated behind `--dart-define=UNI_DB_ENABLED=true`;
  default builds are unaffected.

Phase 1 status: file-level deliverables only. No migrations applied to
live Supabase; no paid API calls; no live ac.kr fetches. The moment
credentials and owner approval arrive, flipping the live flags
(`UNI_DB_LIVE_APIS=true`, `UNI_DB_LIVE_CRAWL=true`) plus applying the
staged migrations brings the system online without further code change
in this layer. See [docs/credentials.md](docs/credentials.md) for the
exact procedural steps.

## Flutter quickstart

```bash
flutter pub get
flutter run                                       # default — uni_db disabled
flutter run --dart-define=UNI_DB_ENABLED=true     # enable uni_db routes
flutter test
```

A few resources for first-time Flutter contributors:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)
