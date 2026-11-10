// business-register — BA0 «시작하기» for an owner without a business.
//
// POST {"biz_no": "1248100998"} with the owner's session (verify_jwt).
// Checks the number with 국세청 (NTS_SERVICE_KEY; without it the business
// waits for a person — pending) and registers it with the caller as owner:
// 계속사업자 is verified at once (T8), 휴업자 waits, 폐업자 is refused.
// Answers {"business_id", "status"} or {"error": CODE} with CODE one of
// BIZ_NO_INVALID, BIZ_NO_UNKNOWN, BIZ_NO_TAKEN, BUSINESS_CLOSED,
// NOT_AUTHENTICATED, INVALID, UNKNOWN.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isValidBizNo, ntsStatus, placeholderName } from "./nts.ts";

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

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: existing, error: readError } = await admin
    .from("businesses")
    .select("id, owner_id, status")
    .eq("biz_no", bizNo)
    .maybeSingle();
  if (readError) return json({ error: "UNKNOWN" }, 500);
  if (existing) {
    return existing.owner_id === user.id
      ? json({ business_id: existing.id, status: existing.status })
      : json({ error: "BIZ_NO_TAKEN" }, 409);
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
