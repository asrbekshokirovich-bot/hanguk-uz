#!/usr/bin/env bash
# Is a database as supabase/migrations leave it? Only reads (tests/verify.sql):
# migrations applied, RLS, rights, the pg_cron jobs, Realtime, the ish-avatars
# bucket, the minimum wage, indexes.
#
#   tests/verify.sh <database url>
#
# Production — hanguk.uz's project, after the Hanguk Ish migrations are applied
# there (it changes nothing; the URL from Project Settings → Database). CI runs
# it on the local stack after `supabase db reset`.
set -euo pipefail
cd "$(dirname "$0")/.."
url=${1:?usage: tests/verify.sh <database url>}
expected=$(ls migrations/*.sql | sed -e 's#.*/##' -e 's#^[0-9]*_##' -e 's#\.sql$##' | paste -sd, -)
report=$(psql "$url" -X -q -v ON_ERROR_STOP=1 -v expected="$expected" -f tests/verify.sql)
echo "$report"
if grep -q '^MISSING' <<<"$report"; then
  echo "verify: something is missing (above)"
  exit 1
fi
echo "verify: the database is as the migrations leave it"
