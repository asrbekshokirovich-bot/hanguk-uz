// ish-iap — the app bought puyl in Google Play / the App Store; this checks
// the purchase with the store and credits it once (ish.iap_credit)
// (2026-11-25).
//
// Body: { store: "google", product_id, token }       (Android purchaseToken)
//    or { store: "apple",  product_id, transaction_id } (iOS)
// Answer: { credited, pyols?, balance } — or { error } with a code.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  a service account with access in Play
//                                     Console (Users and permissions)
//   ISH_ANDROID_PACKAGE               default uz.hanguk.ish
//   APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY (.p8 text)
//   ISH_IOS_BUNDLE_ID                 default uz.hanguk.ish
//
// Auth: the user's own token (checked with auth.getUser; verify_jwt = false
// like ish-delete-account).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { publishableKey, serviceKey } from "../_shared/keys.ts";
import {
  appleToken,
  consumeGoogle,
  googleAccessToken,
  verifyApple,
  VerifyError,
  verifyGoogle,
} from "./verify.ts";

const PRODUCTS = ["puyl_30", "puyl_100", "puyl_300"];
const cors = { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "METHOD" });

  const bearer = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) return json(401, { error: "UNAUTHENTICATED" });
  const url = Deno.env.get("SUPABASE_URL")!;
  const client = createClient(url, publishableKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: whoError } = await client.auth.getUser(bearer);
  if (whoError || !who?.user) return json(401, { error: "UNAUTHENTICATED" });

  let body: { store?: string; product_id?: string; token?: string; transaction_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "INVALID" });
  }
  const productId = String(body.product_id ?? "");
  if (!PRODUCTS.includes(productId)) return json(400, { error: "INVALID" });

  try {
    let transactionId: string;
    let afterCredit: (() => Promise<void>) | null = null;
    if (body.store === "google") {
      const token = String(body.token ?? "");
      if (!token) return json(400, { error: "INVALID" });
      const sa = JSON.parse(Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? "null");
      if (!sa?.client_email) return json(503, { error: "NOT_CONFIGURED" });
      const pkg = Deno.env.get("ISH_ANDROID_PACKAGE") ?? "uz.hanguk.ish";
      const access = await googleAccessToken(sa, fetch);
      transactionId = (await verifyGoogle(fetch, access, pkg, productId, token)).transactionId;
      afterCredit = () => consumeGoogle(fetch, access, pkg, productId, token);
    } else if (body.store === "apple") {
      const keyId = Deno.env.get("APPLE_IAP_KEY_ID") ?? "";
      const issuerId = Deno.env.get("APPLE_IAP_ISSUER_ID") ?? "";
      const privateKey = Deno.env.get("APPLE_IAP_PRIVATE_KEY") ?? "";
      if (!keyId || !issuerId || !privateKey) return json(503, { error: "NOT_CONFIGURED" });
      const bundleId = Deno.env.get("ISH_IOS_BUNDLE_ID") ?? "uz.hanguk.ish";
      const token = await appleToken({ keyId, issuerId, privateKey, bundleId });
      const v = await verifyApple(fetch, token, bundleId, String(body.transaction_id ?? ""), PRODUCTS);
      if (v.productId !== productId) return json(400, { error: "INVALID" });
      transactionId = v.transactionId;
    } else {
      return json(400, { error: "INVALID" });
    }

    const admin = createClient(url, serviceKey(), {
      db: { schema: "ish" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("iap_credit", {
      p_worker: who.user.id,
      p_store: body.store,
      p_transaction: transactionId,
      p_product: productId,
    });
    if (error) {
      const code = /NOT_YOURS|NOT_FOUND|INVALID/.exec(error.message)?.[0] ?? "FAILED";
      return json(code === "FAILED" ? 500 : 400, { error: code });
    }
    // Credited (now or before): the purchase is used up.
    if (afterCredit) await afterCredit().catch((e) => console.error("ish-iap consume", e));
    return json(200, data);
  } catch (e) {
    if (e instanceof VerifyError) return json(400, { error: e.message });
    console.error("ish-iap", e);
    return json(500, { error: "FAILED" });
  }
});
