#!/usr/bin/env bash
# The database at scale: 20 000 workers, 500 businesses, 40 000 shifts,
# 120 000 applications, 400 000 notifications (tests/perf/seed.sql). Prints
# how long each thing the apps and the jobs ask takes and fails when one is
# far slower than it was (tests/perf/measure.sql). Same database setup as
# tests/run.sh, on a database of its own:
#
#   tests/perf.sh            (PGHOST/PGPORT/PGUSER from the environment)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${PERF_DB:-ish_perf}
psql_q() { psql -v ON_ERROR_STOP=1 -X -q "$@"; }
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
start=$(date +%s)
psql_q -d "$DB" -f tests/perf/seed.sql | tail -n 3
echo "seeded in $(( $(date +%s) - start )) s"
psql_q -d "$DB" -f tests/perf/measure.sql 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^psql:[^ ]* ERROR:  /ERROR: /'
