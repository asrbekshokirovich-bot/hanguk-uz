// ish-iap — checking a store purchase with Google Play / Apple (2026-11-25).
// Pure: the HTTP calls go through [Fetcher], so verify_test.ts runs them on
// canned answers. index.ts wires the real fetch, keys and database.

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface Verified {
  /** The store's id for this purchase (one credit per id): Google's order
   *  id (or the token when there is none), Apple's transaction id. */
  transactionId: string;
  productId: string;
}

export class VerifyError extends Error {}

function b64url(bytes: Uint8Array | string): string {
  const s = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemBody(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

// ---------------------------------------------------------------------
// Google Play
// ---------------------------------------------------------------------

export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

/** An OAuth token for the Play Developer API, from a service account the
 *  Play Console has given «View financial data / Manage orders» to. */
export async function googleAccessToken(sa: GoogleServiceAccount, fetcher: Fetcher): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBody(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`)),
  );
  const res = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${payload}.${b64url(sig)}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new VerifyError("GOOGLE_AUTH");
  return data.access_token;
}

const playBase = (pkg: string, product: string, token: string) =>
  `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}` +
  `/purchases/products/${encodeURIComponent(product)}/tokens/${encodeURIComponent(token)}`;

/** purchases.products.get: purchased (0), not cancelled. A consumed one is
 *  still valid (a retry after the credit); the database credits it once. */
export async function verifyGoogle(
  fetcher: Fetcher,
  access: string,
  pkg: string,
  productId: string,
  token: string,
): Promise<Verified> {
  const res = await fetcher(playBase(pkg, productId, token), { headers: { Authorization: `Bearer ${access}` } });
  if (res.status === 404 || res.status === 400 || res.status === 410) throw new VerifyError("NOT_FOUND");
  if (!res.ok) throw new VerifyError("STORE_ERROR");
  const p = await res.json();
  if (p.purchaseState !== 0) throw new VerifyError("NOT_PURCHASED");
  return { transactionId: String(p.orderId || token), productId };
}

/** Consumes the purchase so the worker can buy the same pack again. */
export async function consumeGoogle(fetcher: Fetcher, access: string, pkg: string, productId: string, token: string) {
  await fetcher(`${playBase(pkg, productId, token)}:consume`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}` },
  });
}

// ---------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------

export interface AppleKey {
  keyId: string;
  issuerId: string;
  /** The .p8 file's text (In-App Purchase key from App Store Connect). */
  privateKey: string;
  bundleId: string;
}

/** The App Store Server API token (ES256, 5 minutes). */
export async function appleToken(k: AppleKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: k.keyId, typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: k.issuerId,
    iat: now,
    exp: now + 300,
    aud: "appstoreconnect-v1",
    bid: k.bundleId,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBody(k.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`)),
  );
  return `${header}.${payload}.${b64url(sig)}`;
}

/** The payload of a JWS from Apple (read straight from Apple over HTTPS). */
export function jwsPayload(jws: string): Record<string, unknown> {
  const part = jws.split(".")[1] ?? "";
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
}

/** GET /inApps/v1/transactions/{id}: production first, then the sandbox
 *  (TestFlight and review builds buy in the sandbox). */
export async function verifyApple(
  fetcher: Fetcher,
  token: string,
  bundleId: string,
  transactionId: string,
  productIds: string[],
): Promise<Verified> {
  if (!/^\d{1,30}$/.test(transactionId)) throw new VerifyError("INVALID");
  let res: Response | null = null;
  for (const host of ["api.storekit.itunes.apple.com", "api.storekit-sandbox.itunes.apple.com"]) {
    res = await fetcher(`https://${host}/inApps/v1/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 404) break;
  }
  if (!res || res.status === 404) throw new VerifyError("NOT_FOUND");
  if (!res.ok) throw new VerifyError("STORE_ERROR");
  const t = jwsPayload(String((await res.json()).signedTransactionInfo ?? ""));
  if (t.bundleId !== bundleId) throw new VerifyError("WRONG_APP");
  if (t.revocationDate) throw new VerifyError("REVOKED");
  const productId = String(t.productId ?? "");
  if (!productIds.includes(productId)) throw new VerifyError("INVALID");
  return { transactionId: String(t.transactionId ?? transactionId), productId };
}
