#!/usr/bin/env bash
#
# Manage the Hanguk Telegram bot webhook.
#
# Requirements (env vars):
#   TELEGRAM_BOT_TOKEN   - bot token from @BotFather
#   SUPABASE_PROJECT_REF - Supabase project ref (e.g. lysjdtyanhdfphqyijsr)
#                          OR set WEBHOOK_URL directly.
#
# Usage:
#   ./scripts/telegram-bot.sh set-webhook      Register the webhook with Telegram
#   ./scripts/telegram-bot.sh delete-webhook   Remove the webhook
#   ./scripts/telegram-bot.sh info             Show current webhook info
#   ./scripts/telegram-bot.sh set-commands     Register the bot command menu
#
set -euo pipefail

: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN (from @BotFather)}"

API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

webhook_url() {
  if [[ -n "${WEBHOOK_URL:-}" ]]; then
    echo "$WEBHOOK_URL"
  else
    : "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF or WEBHOOK_URL}"
    echo "https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/telegram-webhook"
  fi
}

cmd="${1:-info}"
case "$cmd" in
  set-webhook)
    url="$(webhook_url)"
    echo "Registering webhook: $url"
    curl -fsS -X POST "${API}/setWebhook" \
      -H "Content-Type: application/json" \
      -d "{\"url\":\"${url}\",\"allowed_updates\":[\"message\",\"callback_query\"]}"
    echo
    ;;
  delete-webhook)
    curl -fsS -X POST "${API}/deleteWebhook" -d "drop_pending_updates=false"
    echo
    ;;
  info)
    curl -fsS "${API}/getWebhookInfo"
    echo
    ;;
  set-commands)
    curl -fsS -X POST "${API}/setMyCommands" \
      -H "Content-Type: application/json" \
      -d '{"commands":[
        {"command":"start","description":"Boshlash / Начать"},
        {"command":"help","description":"Yordam / Помощь"},
        {"command":"ru","description":"Русский тил"},
        {"command":"uz","description":"O‘zbek tili"}
      ]}'
    echo
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    echo "Usage: $0 {set-webhook|delete-webhook|info|set-commands}" >&2
    exit 1
    ;;
esac
