-- Diagnostic table for capturing raw VoIP webhook requests during provider
-- onboarding. Lets us SQL-inspect a provider's exact payload format without
-- relying on console logs that get drowned in unrelated traffic.
CREATE TABLE IF NOT EXISTS public.voip_webhook_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL,
  url text NOT NULL,
  query jsonb NOT NULL DEFAULT '{}'::jsonb,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_type text,
  raw_body text,
  parsed_payload jsonb,
  source_ip text,
  notes text
);

CREATE INDEX IF NOT EXISTS voip_webhook_captures_received_at_idx
  ON public.voip_webhook_captures (received_at DESC);

ALTER TABLE public.voip_webhook_captures ENABLE ROW LEVEL SECURITY;

-- Only the service role (used by edge functions) can read/write captures.
-- No public policies => browser clients cannot see this debug data.
COMMENT ON TABLE public.voip_webhook_captures IS
  'Raw VoIP webhook requests captured for provider onboarding/diagnostics. Service-role only.';
