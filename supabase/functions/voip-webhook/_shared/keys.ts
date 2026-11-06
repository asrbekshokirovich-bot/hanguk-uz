// Vendored copy of supabase/functions/_shared/keys.ts (voip-webhook keeps its
// shared files beside it). Keep the two identical.
// Supabase API keys for edge functions, off the legacy JWT keys.
//
// Security 2026-11-05: the project is moving from the legacy anon /
// service_role JWT keys to sb_publishable_ / sb_secret_ keys so the legacy ones
// can be deactivated. Edge functions get the new keys as JSON objects keyed by
// name ("default"):
//   SUPABASE_SECRET_KEYS       = {"default":"sb_secret_..."}
//   SUPABASE_PUBLISHABLE_KEYS  = {"default":"sb_publishable_..."}
// The legacy SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are only a fallback
// for the transition and stop working once the legacy keys are deactivated.
//
// The new keys are NOT JWTs: they go on the `apikey` header. Sent as
// `Authorization: Bearer sb_...` to a function with verify_jwt = true, the
// gateway answers "Invalid JWT".

function keysFromEnv(name: string): string[] {
  try {
    const raw = Deno.env.get(name);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return [];
    const map = parsed as Record<string, unknown>;
    const ordered = [map["default"], ...Object.values(map)];
    return [...new Set(ordered.filter((v): v is string => typeof v === "string" && v.length > 0))];
  } catch (_e) {
    return [];
  }
}

/** Every sb_secret_ key configured for this project ("default" first). */
export function secretKeys(): string[] {
  return keysFromEnv("SUPABASE_SECRET_KEYS");
}

/** Every sb_publishable_ key configured for this project ("default" first). */
export function publishableKeys(): string[] {
  return keysFromEnv("SUPABASE_PUBLISHABLE_KEYS");
}

/** Server-side key: the "default" secret key, else the legacy service_role key. */
export function serviceKey(): string {
  return secretKeys()[0] ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

/** Public key: the "default" publishable key, else the legacy anon key. */
export function publishableKey(): string {
  return publishableKeys()[0] ?? Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
}

/** Every public key a client may send (new publishable keys and the legacy anon key). */
export function allPublicKeys(): string[] {
  return [...publishableKeys(), Deno.env.get("SUPABASE_ANON_KEY") ?? "", Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? ""]
    .filter((k, i, a) => !!k && a.indexOf(k) === i);
}

/** True for a legacy JWT key (the new sb_ keys are not JWTs). */
export function isLegacyJwt(key: string): boolean {
  return key.startsWith("eyJ");
}

/**
 * Headers for one edge function calling another as the server. The key goes on
 * `apikey`; `Authorization: Bearer` is added only while the key is still a
 * legacy JWT (an sb_secret_ key there would be rejected as "Invalid JWT").
 */
export function internalFunctionHeaders(): Record<string, string> {
  const key = serviceKey();
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: key };
  if (isLegacyJwt(key)) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}
