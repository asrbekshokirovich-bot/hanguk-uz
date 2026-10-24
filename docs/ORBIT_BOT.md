# The Orbit bot — which one is it, and why it goes quiet

Orbit is the owner's command-center bot: staff DM it a task or a payment, in
text or voice, and it turns that into a confirmed record (`orbit.tasks`,
`orbit.transactions`, `orbit.scheduled`) and pushes it into the business it
belongs to. The handler is the `orbit-telegram-webhook` Edge Function.

## There is more than one bot named "Orbit"

The token in `ORBIT_TELEGRAM_BOT_TOKEN` belongs to **@Orbit_CC_Bot**
(id `8704833310`). That is the only bot this project can answer as.

**@OrbitFABOT** is a *different* bot with the same display name ("Orbit").
Nothing in this project holds its token, so nothing is registered to receive
its updates. Writing to it looks exactly like a broken bot — the message is
delivered, and nobody is listening. It is not a bug in the code.

If @OrbitFABOT is the bot that should be used, its token has to replace the
secret and its webhook has to be registered:

```bash
supabase secrets set ORBIT_TELEGRAM_BOT_TOKEN="<@OrbitFABOT token from BotFather>"
# then, with a staff/service JWT:
POST /functions/v1/orbit-telegram-admin  {"action":"register"}
```

`register` sets the webhook **with** `secret_token`. Registering it any other
way (a bare `setWebhook` URL, for example) makes every update fail the
`x-telegram-bot-api-secret-token` check in `orbit-telegram-webhook` and return
401 — the bot then stays silent while Telegram reports no error at all.

## Checking whether the bot is alive

`orbit-telegram-admin` (verify_jwt = true, so the token never leaves Supabase):

| Call | Answers |
|---|---|
| `GET ?action=status` | Which bot the token belongs to, where Telegram is delivering, `pending_update_count`, `last_error_message` |
| `POST {"action":"register"}` | Re-points Telegram here, secret included |
| `POST {"action":"ping","chat_id":N}` | Actually sends a message — the only check that proves delivery works |

`status` alone can look perfectly healthy while the wrong bot is configured:
it reports the registration, not whether anyone is writing to that bot. When
the inbox is quiet, compare the `bot.username` it returns against the bot you
are actually messaging *before* looking for anything else.

An empty `orbit.inbound_messages` with `matches: true`, `pending_update_count:
0` and no `last_error_message` means Telegram has nothing to deliver — i.e.
nobody is writing to the configured bot.
