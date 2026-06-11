# Instagram integration

Connects an Instagram Professional account to the CRM so client DMs land in the
unified inbox (`/crm/messages`) and staff can reply and convert conversations
into leads.

## Pieces

| Piece | Path | Purpose |
| --- | --- | --- |
| Inbound webhook | `supabase/functions/instagram-webhook` | Verifies Meta's challenge, validates the `X-Hub-Signature-256` signature, stores incoming DMs in `messages` / `message_threads`, enriches the sender with name + avatar. |
| Outbound send | `supabase/functions/send-instagram` | Authenticated staff replies via the Instagram Send API. Invoked from `MessagesContext.sendMessage`. |
| Inbox UI | `src/components/messages/*`, `src/contexts/MessagesContext.tsx` | Already source-aware (`source = 'instagram'`); shows the conversation and a **Convert to lead** action. |
| Settings panel | `src/components/crm/pages/IntegrationsSettings.tsx` | Shows live connection status and the webhook URL to paste into Meta. |

## Required Supabase function secrets

| Secret | Used by | Notes |
| --- | --- | --- |
| `INSTAGRAM_VERIFY_TOKEN` | webhook | Any random string. Must match the Verify Token entered in the Meta dashboard. |
| `INSTAGRAM_ACCESS_TOKEN` | webhook + send | Instagram access token with messaging permissions (also used to look up sender profiles). |
| `INSTAGRAM_APP_SECRET` | webhook | App secret used to verify the request signature. Strongly recommended; if unset, signature checks are skipped. |
| `INSTAGRAM_GRAPH_API_VERSION` | optional | Defaults to `v21.0`. |
| `INSTAGRAM_GRAPH_API_HOST` | optional | Defaults to `graph.instagram.com` (Instagram-login API). Set to `graph.facebook.com` for the Messenger/Facebook-login flavor. |

## Setup

1. In the [Meta App dashboard](https://developers.facebook.com/apps), connect an
   Instagram Professional account and request the messaging permissions
   (`instagram_business_basic`, `instagram_business_manage_messages`).
2. Set the secrets above on the Supabase project.
3. Add the callback URL as the Instagram webhook (copy it from
   **CRM → Settings → Integrations**, or use
   `https://<project-ref>.supabase.co/functions/v1/instagram-webhook`).
4. Enter the same value as `INSTAGRAM_VERIFY_TOKEN` for the Verify Token and
   subscribe to the **messages** field.
5. Send a test DM to the account — it should appear in `/crm/messages`.

Both functions are registered in `supabase/config.toml` with `verify_jwt = false`
(`instagram-webhook` is called by Meta; `send-instagram` enforces auth itself by
validating the caller's Supabase JWT).
