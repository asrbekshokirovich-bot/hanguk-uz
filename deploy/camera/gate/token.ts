// CRM kamera kaliti: Supabase'dagi camera-session imzolaydi, ofisdagi camera-gate tekshiradi.
//
//   v1.<payload>.<imzo>
//   payload = base64url(JSON {u, c, iat, exp})
//   imzo    = base64url(HMAC-SHA256(GATE_SECRET, "v1." + payload))
//
// GATE_SECRET ikki joyda bir xil turadi: Supabase secrets (CAMERA_GATE_SECRET) va
// ofis serveridagi secrets/gate.env. Internetda faqat shu qisqa muddatli kalitlar yuradi.
// Tashqi kutubxona yo'q. Bir xil ikki nusxa: deploy/camera/gate/token.ts va
// supabase/functions/_shared/camera-token.ts — farq bo'lsa gate/token_sync_test.ts yiqiladi.

export const TOKEN_VERSION = "v1";
/** Kalitning eng uzun umri, soniya. camera-session 300 s beradi. */
export const MAX_LIFETIME_SEC = 600;
/** Server soatlari farqiga ruxsat, soniya. */
export const CLOCK_SKEW_SEC = 30;
/** Kamera nomi: kichik lotin harf, raqam va "-"; "_" yo'q, chunki "<nom>_sub" kichik oqim uchun band. */
export const CAMERA_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export interface CameraClaims {
  /** auth.users id */
  u: string;
  /** Ruxsat berilgan kameralar yoki ["*"] (hammasi). */
  c: string[];
  /** Berilgan vaqt, unix soniya. */
  iat: number;
  /** Tugash vaqti, unix soniya. */
  exp: number;
}

export type VerifyFailure = "format" | "signature" | "claims" | "lifetime" | "expired";
export type VerifyResult =
  | { ok: true; claims: CameraClaims }
  | { ok: false; reason: VerifyFailure };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function importSecret(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(key: CryptoKey, claims: CameraClaims): Promise<string> {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const signed = `${TOKEN_VERSION}.${payload}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(signed)));
  return `${signed}.${base64UrlEncode(sig)}`;
}

function isClaims(value: unknown): value is CameraClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return typeof o.u === "string" && o.u.length > 0 && o.u.length <= 64 &&
    Array.isArray(o.c) && o.c.length > 0 && o.c.length <= 64 &&
    o.c.every((x) => typeof x === "string" && (x === "*" || CAMERA_ID_RE.test(x))) &&
    typeof o.iat === "number" && Number.isFinite(o.iat) &&
    typeof o.exp === "number" && Number.isFinite(o.exp);
}

export async function verifyToken(
  key: CryptoKey,
  token: string | null | undefined,
  nowSec: number = Date.now() / 1000,
): Promise<VerifyResult> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: "format" };
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return { ok: false, reason: "format" };
  const sig = base64UrlDecode(parts[2]);
  if (!sig || sig.length !== 32) return { ok: false, reason: "format" };
  const valid = await crypto.subtle.verify("HMAC", key, sig, encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) return { ok: false, reason: "signature" };
  const raw = base64UrlDecode(parts[1]);
  if (!raw) return { ok: false, reason: "format" };
  let claims: unknown;
  try {
    claims = JSON.parse(decoder.decode(raw));
  } catch {
    return { ok: false, reason: "format" };
  }
  if (!isClaims(claims)) return { ok: false, reason: "claims" };
  if (claims.exp <= claims.iat || claims.exp - claims.iat > MAX_LIFETIME_SEC) {
    return { ok: false, reason: "lifetime" };
  }
  if (claims.iat > nowSec + CLOCK_SKEW_SEC) return { ok: false, reason: "claims" };
  if (nowSec > claims.exp + CLOCK_SKEW_SEC) return { ok: false, reason: "expired" };
  return { ok: true, claims };
}

export function allowsCamera(claims: CameraClaims, camera: string): boolean {
  return claims.c.includes("*") || claims.c.includes(camera);
}
