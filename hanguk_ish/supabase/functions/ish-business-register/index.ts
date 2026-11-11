// ish-business-register — BA0 «시작하기» for an owner without a business.
//
// Hanguk Ish lives in hanguk.uz's project, in the schema `ish` (P48): the
// service-role client reads and writes there.
//
// POST {"biz_no": "1248100998"} with the owner's session (verify_jwt).
// Checks the number with 국세청 (NTS_SERVICE_KEY; without it the business
// waits for a person — pending) and registers it with the caller as owner:
// 계속사업자 is verified at once (T8), 휴업자 waits, 폐업자 is refused.
// A number the caller already registered that still waits is checked again
// (the owner app sends it when it opens), so a missing key or a 국세청 outage
// at registration does not keep the business waiting for good.
// Answers {"business_id", "status"} or {"error": CODE} with CODE one of
// BIZ_NO_INVALID, BIZ_NO_UNKNOWN, BIZ_NO_TAKEN, BUSINESS_CLOSED,
// TOO_MANY_REQUESTS, NOT_AUTHENTICATED, INVALID, UNKNOWN.
//
// At most ten tries an hour per person: each may ask 국세청, and a script
// could try numbers to learn which businesses use the app.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isValidBizNo, ntsStatus, placeholderName, recheckUpdate } from "./nts.ts";

const MAX_TRIES_PER_HOUR = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "INVALID" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "NOT_AUTHENTICATED" }, 401);

  let body: { biz_no?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID" }, 400);
  }
  const bizNo = String(body?.biz_no ?? "").replace(/\D/g, "");
  if (!isValidBizNo(bizNo)) return json({ error: "BIZ_NO_INVALID" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false }, db: { schema: "ish" } });
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: tries, error: triesError } = await admin
    .from("business_register_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if (triesError) return json({ error: "UNKNOWN" }, 500);
  if ((tries ?? 0) >= MAX_TRIES_PER_HOUR) return json({ error: "TOO_MANY_REQUESTS" }, 429);
  const { error: logError } = await admin
    .from("business_register_attempts")
    .insert({ user_id: user.id, biz_no: bizNo });
  if (logError) return json({ error: "UNKNOWN" }, 500);

  const { data: existing, error: readError } = await admin
    .from("businesses")
    .select("id, owner_id, status")
    .eq("biz_no", bizNo)
    .maybeSingle();
  if (readError) return json({ error: "UNKNOWN" }, 500);
  if (existing) {
    if (existing.owner_id !== user.id) return json({ error: "BIZ_NO_TAKEN" }, 409);
    if (existing.status !== "pending") return json({ business_id: existing.id, status: existing.status });
    // Still waiting (the first time there was no key or no answer, or it was
    // 휴업): ask 국세청 again. The owner app does this when it opens.
    const update = recheckUpdate(await ntsStatus(bizNo, Deno.env.get("NTS_SERVICE_KEY")));
    if (update) {
      const { error: updateError } = await admin
        .from("businesses")
        .update({ ...update, nts_checked_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updateError) return json({ error: "UNKNOWN" }, 500);
    }
    const status = update?.status ?? existing.status;
    return status === "rejected"
      ? json({ error: "BUSINESS_CLOSED" }, 400)
      : json({ business_id: existing.id, status });
  }

  const nts = await ntsStatus(bizNo, Deno.env.get("NTS_SERVICE_KEY"));
  if (nts.kind === "unknown") return json({ error: "BIZ_NO_UNKNOWN" }, 400);
  if (nts.kind === "closed") return json({ error: "BUSINESS_CLOSED" }, 400);

  const { data: business, error } = await admin.rpc("register_business", {
    p_owner: user.id,
    p_biz_no: bizNo,
    p_name: placeholderName(bizNo),
    p_nts_status: "code" in nts ? nts.code : null,
  });
  if (error) {
    return error.code === "23505" ? json({ error: "BIZ_NO_TAKEN" }, 409) : json({ error: "UNKNOWN" }, 500);
  }
  return json({ business_id: business.id, status: business.status });
});
