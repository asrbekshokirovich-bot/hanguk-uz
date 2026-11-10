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
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-ish_test}
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
for f in migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  psql_q -d "$DB" -f "$f"
done
psql_q -d "$DB" -f tests/helpers.sql
pass=0
for f in tests/*_test.sql; do
  echo "test     $(basename "$f")"
  psql_q -d "$DB" -c 'begin' -f tests/fixtures.sql -f "$f" -c 'rollback' >/dev/null
  pass=$((pass + 1))
done
echo "OK: $pass test files passed"
