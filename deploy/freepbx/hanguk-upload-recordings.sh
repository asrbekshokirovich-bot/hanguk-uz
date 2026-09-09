#!/bin/bash
# Ships finished call recordings to Supabase Storage, then tells the CRM the
# file has landed.
#
# WHY A QUEUE AND NOT A DIRECT UPLOAD AT HANGUP
#
# The office internet drops, and Storage occasionally answers slowly. An upload
# fired once at hangup and never retried loses the recording silently — and
# silently is the problem: nobody notices until somebody looks for a call from
# last month. So every recording waits in a queue directory until an upload
# actually succeeds, and only then is it removed. A failed run leaves the file
# exactly where it was for the next run to pick up.
#
# Runs from cron every 10 minutes. Overlapping runs are prevented with flock,
# because a slow upload must not have a second copy racing it.
set -uo pipefail

CONF=/etc/hanguk/crm.conf
[ -r "$CONF" ] || { logger -t hanguk-rec "missing $CONF"; exit 0; }
# shellcheck source=/dev/null
. "$CONF"   # CRM_URL, SUPABASE_SECRET_KEY, ASTERISK_WEBHOOK_SECRET

QUEUE=${QUEUE:-/var/spool/hanguk/pending}
FAILED=${FAILED:-/var/spool/hanguk/failed}
BUCKET=call-recordings
MAX_ATTEMPTS=${MAX_ATTEMPTS:-30}

mkdir -p "$QUEUE" "$FAILED"

exec 9>/var/lock/hanguk-upload.lock
flock -n 9 || { logger -t hanguk-rec "previous run still going"; exit 0; }

shopt -s nullglob
for FILE in "$QUEUE"/*.wav "$QUEUE"/*.mp3; do
  BASE=$(basename "$FILE")
  # The dialplan names the file <uniqueid>.<ext> so the CRM can match the call.
  UNIQUEID="${BASE%.*}"
  ATTEMPTS_FILE="$QUEUE/.$BASE.attempts"
  ATTEMPTS=$(cat "$ATTEMPTS_FILE" 2>/dev/null || echo 0)

  OBJECT="$(date -u -r "$FILE" +%Y/%m)/$BASE"
  CODE=$(curl -sS --max-time 120 -o /tmp/hanguk-upload.out -w '%{http_code}' \
    -X POST "$CRM_URL/storage/v1/object/$BUCKET/$OBJECT" \
    -H "apikey: $SUPABASE_SECRET_KEY" \
    -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
    -H "Content-Type: audio/mpeg" \
    -H "x-upsert: true" \
    --data-binary "@$FILE")

  if [ "$CODE" != "200" ] && [ "$CODE" != "201" ]; then
    ATTEMPTS=$((ATTEMPTS + 1))
    echo "$ATTEMPTS" > "$ATTEMPTS_FILE"
    logger -t hanguk-rec "upload $BASE failed http=$CODE attempt=$ATTEMPTS"
    # Kept, not deleted: a file that has failed many times is a problem to look
    # at, never a recording to throw away.
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
      mv -f "$FILE" "$FAILED/" && rm -f "$ATTEMPTS_FILE"
      logger -t hanguk-rec "moved $BASE to $FAILED after $ATTEMPTS attempts"
    fi
    continue
  fi

  # Storage has the bytes; now let the CRM attach it and start the analysis.
  NOTIFY=$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' \
    -X POST "$CRM_URL/functions/v1/voip-webhook/asterisk" \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: $ASTERISK_WEBHOOK_SECRET" \
    -d "$(jq -cn --arg u "$UNIQUEID" --arg p "$OBJECT" \
          '{event:"recording", uniqueid:$u, recording_path:$p}')")

  if [ "$NOTIFY" != "200" ]; then
    # The object is uploaded, so re-running is harmless (x-upsert) and the
    # notify will be retried. Leave the file queued.
    ATTEMPTS=$((ATTEMPTS + 1))
    echo "$ATTEMPTS" > "$ATTEMPTS_FILE"
    logger -t hanguk-rec "notify $BASE failed http=$NOTIFY"
    continue
  fi

  rm -f "$FILE" "$ATTEMPTS_FILE"
  logger -t hanguk-rec "uploaded $BASE -> $OBJECT"
done
