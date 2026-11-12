// The API keys of the project this function runs in (hanguk.uz's, P48).
//
// hanguk.uz is moving off the legacy anon / service_role JWT keys. Edge
// functions get the new keys as JSON keyed by name:
//   SUPABASE_SECRET_KEYS      = {"default":"sb_secret_…"}
//   SUPABASE_PUBLISHABLE_KEYS = {"default":"sb_publishable_…"}
// The legacy SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are the fallback
// (the local stack of the tests has only those); they stop working once the
// project turns the legacy keys off. The same rule as hanguk.uz's own
// supabase/functions/_shared/keys.ts.

type Env = (name: string) => string | undefined;

const denoEnv: Env = (name) => Deno.env.get(name);

/** The "default" key of a JSON key map (else its first key), or null. */
export function keyFromMap(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const map = parsed as Record<string, unknown>;
    for (const value of [map["default"], ...Object.values(map)]) {
      if (typeof value === "string" && value.length > 0) return value;
    }
  } catch {
    // Not JSON: no key here.
  }
  return null;
}

/** The server's key: the new secret key, else the legacy service_role key. */
export function serviceKey(env: Env = denoEnv): string {
  return keyFromMap(env("SUPABASE_SECRET_KEYS")) ?? env("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

/** The public key: the new publishable key, else the legacy anon key. */
export function publishableKey(env: Env = denoEnv): string {
  return keyFromMap(env("SUPABASE_PUBLISHABLE_KEYS")) ?? env("SUPABASE_ANON_KEY") ?? "";
}
