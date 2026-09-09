#!/bin/bash
# Sends one call event from Asterisk to the CRM.
#
# Called from extensions_custom.conf on start / answer / hangup. Deliberately
# does nothing clever: one curl, a short timeout, and it never blocks the
# dialplan — a CRM outage must not stop the phones from ringing.
#
# Usage: hanguk-call-event.sh <event> <uniqueid> <ext> <phone> <direction> [extra-json]
set -u
CONF=/etc/hanguk/crm.conf
[ -r "$CONF" ] || { logger -t hanguk-call "missing $CONF"; exit 0; }
# shellcheck source=/dev/null
. "$CONF"   # CRM_URL, ASTERISK_WEBHOOK_SECRET

EVENT="${1:-}"; UNIQUEID="${2:-}"; EXT="${3:-}"; PHONE="${4:-}"; DIRECTION="${5:-incoming}"
EXTRA="${6:-{\}}"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

BODY=$(jq -cn --arg e "$EVENT" --arg u "$UNIQUEID" --arg x "$EXT" --arg p "$PHONE" \
              --arg d "$DIRECTION" --arg t "$NOW" --argjson extra "$EXTRA" \
  '{event:$e, uniqueid:$u, ext:$x, phone:$p, direction:$d}
   + (if $e == "start"  then {started_at:$t}  else {} end)
   + (if $e == "answer" then {answered_at:$t} else {} end)
   + (if $e == "hangup" then {ended_at:$t}    else {} end)
   + $extra')

curl -sS --max-time 8 -o /dev/null -w '%{http_code}' \
  -X POST "$CRM_URL/functions/v1/voip-webhook/asterisk" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $ASTERISK_WEBHOOK_SECRET" \
  -d "$BODY" \
  | logger -t hanguk-call "$EVENT $UNIQUEID ->"
exit 0
