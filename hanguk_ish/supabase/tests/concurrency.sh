#!/usr/bin/env bash
# Two requests of one worker at the very same moment, for two shifts that
# overlap (fixtures s1 and s3, an hour in common): the second must wait for
# the first and then be refused (TIME_CONFLICT). Before P30 both went through.
#
# Needs data that both sessions see (committed), so tests/run.sh calls it on
# its throwaway database after the other tests: tests/concurrency.sh <db>
set -euo pipefail
cd "$(dirname "$0")/.."
DB=$1
psql_q() { psql -v ON_ERROR_STOP=1 -X -q -d "$DB" "$@"; }
psql_q -f tests/fixtures.sql >/dev/null
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
as_a1="select tests.as_user('00000000-0000-0000-0000-0000000000a1')"

# The first request (s1) keeps its transaction open for two seconds.
psql_q -t -A -c "begin" -c "$as_a1" \
  -c "select status from ish.apply_to_shift('20000000-0000-0000-0000-000000000001')" \
  -c "select pg_sleep(2)" -c "commit" >"$out/first" 2>&1 &
first=$!
# Until it sleeps: its application is in, not yet committed.
for _ in $(seq 1 50); do
  asleep=$(psql -X -t -A -d "$DB" -c "select count(*) from pg_stat_activity
    where datname = current_database() and state = 'active' and query = 'select pg_sleep(2)'")
  [ "$asleep" = 1 ] && break
  sleep 0.1
done
[ "$asleep" = 1 ] || { echo "FAILED: the first request never got to its pause"; cat "$out/first"; exit 1; }

# The second (s3), meanwhile.
start=$(date +%s%N)
if psql_q -t -A -c "begin" -c "$as_a1" \
     -c "select status from ish.apply_to_shift('20000000-0000-0000-0000-000000000003')" \
     -c "commit" >"$out/second" 2>&1; then
  second=ok
else
  second=refused
fi
waited_ms=$(( ($(date +%s%N) - start) / 1000000 ))
wait "$first"

fail() { echo "FAILED: $1"; echo "--- first:"; cat "$out/first"; echo "--- second:"; cat "$out/second"; exit 1; }
grep -q '^confirmed$' "$out/first" || fail "the first request should be confirmed"
[ "$second" = refused ] || fail "the second request went through: two overlapping shifts"
grep -q 'TIME_CONFLICT' "$out/second" || fail "the second should be refused with TIME_CONFLICT"
[ "$waited_ms" -ge 1000 ] || fail "the second did not wait for the first (${waited_ms} ms)"
live=$(psql -X -t -A -d "$DB" -c "select count(*) from ish.applications
  where worker_id = '00000000-0000-0000-0000-0000000000a1'
    and shift_id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003')
    and status in ('pending', 'confirmed', 'checked_in')")
[ "$live" = 1 ] || fail "a1 holds $live of the two overlapping shifts"
echo "concurrency: the second request waited ${waited_ms} ms and was refused (TIME_CONFLICT)"
