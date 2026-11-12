#!/usr/bin/env bash
# Runs the database tests on a plain PostgreSQL 15+:
#   tests/run.sh            (uses PGHOST/PGPORT/PGUSER from the environment)
# Creates a throwaway database, applies tests/supabase_shim.sql (stand-in for
# what Supabase provides), every migration in order, tests/fixtures.sql, then
# each tests/*_test.sql in its own transaction. Any failed assertion aborts.
#
# With SUPABASE_DB_URL set (a local `supabase start` stack whose migrations
# were applied by `supabase db reset`), it skips the database setup and runs
# the same tests against the real Supabase schema.
#
# On the throwaway database it ends with tests/concurrency.sh: two sessions
# at the same moment (it commits the fixtures, so not on the stack).
#
# NEXT_YEAR=1 tests/run.sh: the same tests with next year's minimum wage
# already in force (the highest known one, for every year). Test shifts start
# from now(), and at the turn of the year «in two days» is next year: a wage
# that is legal today must not fail them then (P44). 10_schema_test checks
# the real table, so it is left out there.
set -euo pipefail
cd "$(dirname "$0")/.."
NEXT_YEAR=${NEXT_YEAR:-}
DB=${TEST_DB:-ish_test${NEXT_YEAR:+_next_year}}
psql_q() { psql -v ON_ERROR_STOP=1 -X -q "$@"; }

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  psql_q "$SUPABASE_DB_URL" -f tests/helpers.sql
  pass=0
  for f in tests/*_test.sql; do
    echo "test     $(basename "$f")"
    psql_q "$SUPABASE_DB_URL" -c 'begin' -f tests/fixtures.sql -f "$f" -c 'rollback' >/dev/null
    pass=$((pass + 1))
  done
  echo "OK: $pass test files passed (Supabase stack)"
  exit 0
fi
psql_q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql_q -d "$DB" -c "do \$\$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end \$\$"
sed -e '/^create role /d' -e '/^grant anon, authenticated, service_role to authenticator;/d' tests/supabase_shim.sql | psql_q -d "$DB"
# hanguk.uz's look-alikes first (P48: one project): the migrations must apply
# next to them. Its sign-up function is the repository root's migration.
psql_q -d "$DB" -f tests/main_app_stub.sql
psql_q -d "$DB" -f ../../supabase/migrations/20261111150000_hanguk_ish_skip_main_profile.sql
psql_q -d "$DB" -f ../../supabase/migrations/20261111180000_hanguk_ish_skip_anonymous.sql
psql_q -d "$DB" -f ../../supabase/migrations/20261112140000_hanguk_ish_no_anonymous.sql
psql_q -d "$DB" -c "create trigger on_auth_user_created after insert on auth.users
                    for each row execute function public.handle_new_user()"
for f in migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  psql_q -d "$DB" -f "$f"
done
psql_q -d "$DB" -f tests/helpers.sql
if [ -n "$NEXT_YEAR" ]; then
  psql_q -d "$DB" -c "update ish.minimum_wages set hourly_won = (select max(hourly_won) from ish.minimum_wages)"
  echo "minimum  $(psql -X -At -d "$DB" -c 'select max(hourly_won) from ish.minimum_wages') 원 for every year"
fi
pass=0
for f in tests/*_test.sql; do
  if [ -n "$NEXT_YEAR" ] && [ "$(basename "$f")" = 10_schema_test.sql ]; then
    echo "skip     $(basename "$f") (the real minimum wage table)"
    continue
  fi
  echo "test     $(basename "$f")"
  psql_q -d "$DB" -c 'begin' -f tests/fixtures.sql -f "$f" -c 'rollback' >/dev/null
  pass=$((pass + 1))
done
echo "OK: $pass test files passed${NEXT_YEAR:+ (with the next year minimum wage)}"
[ -n "$NEXT_YEAR" ] && exit 0
# Last: it commits the fixtures (two sessions must see them).
bash tests/concurrency.sh "$DB"
