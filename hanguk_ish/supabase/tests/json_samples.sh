#!/usr/bin/env bash
# Prints what the apps receive from the database functions as one JSON object
# (see tests/json_samples.sql). Same database setup as tests/run.sh:
#
#   tests/json_samples.sh > ../test/fixtures/backend_samples.json
#
# With SUPABASE_DB_URL set, reads a local Supabase stack instead.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-ish_samples}
psql_q() { psql -v ON_ERROR_STOP=1 -X -q "$@"; }

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  target=("$SUPABASE_DB_URL")
  psql_q "$SUPABASE_DB_URL" -f tests/helpers.sql >/dev/null 2>&1 || true
else
  psql_q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
  psql_q -d "$DB" -c "do \$\$ begin
    if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end \$\$" >/dev/null
  sed -e '/^create role /d' -e '/^grant anon, authenticated, service_role to authenticator;/d' tests/supabase_shim.sql \
    | psql_q -d "$DB" >/dev/null
  for f in migrations/*.sql; do psql_q -d "$DB" -f "$f" >/dev/null; done
  psql_q -d "$DB" -f tests/helpers.sql >/dev/null
  target=(-d "$DB")
fi
psql_q "${target[@]}" -At -c 'begin' -f tests/fixtures.sql -f tests/json_samples.sql -c 'rollback' \
  | sed -n '/^{/,/^}/p'
