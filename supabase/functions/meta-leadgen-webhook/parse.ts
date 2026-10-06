// The pure half of meta-leadgen-webhook (spec §5, decision 3.1): the webhook
// handshake and signature, the leadgen ids in a delivery, and the mapping of a
// Graph API lead (the answers of the form) onto a `leads` row. No remote
// imports, so vitest runs it with real-looking payloads.
//
// What the row does NOT contain on purpose: timer fields. The database trigger
// on `leads` starts the 10-minute timer (first_contact_at = the form's own
// created_time) and merges the person into an existing card by phone.
// deno-lint-ignore-file no-explicit-any

import { constantTimeEqual } from "../_shared/service-auth.ts";
import { fold, matchAge, matchCertificate, matchGoal, matchRegion } from "../_shared/lead-values.ts";

// ---------------------------------------------------------------- handshake

/** GET ?hub.mode=subscribe&hub.verify_token=..&hub.challenge=..  (Meta's subscription check) */
export function hubVerification(
  params: URLSearchParams,
  expectedToken: string | null | undefined,
): { status: number; body: string } {
  if (!expectedToken) return { status: 503, body: "META_VERIFY_TOKEN is not configured" };
  const token = params.get("hub.verify_token") ?? "";
  if (params.get("hub.mode") === "subscribe" && constantTimeEqual(token, expectedToken)) {
    return { status: 200, body: params.get("hub.challenge") ?? "" };
  }
  return { status: 403, body: "Forbidden" };
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body), compared in constant time. */
export async function verifySignature(raw: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  return constantTimeEqual("sha256=" + hex(mac), header.trim().toLowerCase());
}

// ---------------------------------------------------------------- delivery

export interface LeadgenRef {
  leadgen_id: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  /** unix seconds, from the webhook */
  created_time?: number;
}

/**
 * Every leadgen id in a delivery (entry[].changes[] with field "leadgen").
 * The id goes into a Graph API path, so anything but digits is refused.
 */
export function extractLeadgenRefs(body: any): LeadgenRef[] {
  const out: LeadgenRef[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== "leadgen") continue;
      const v = change.value ?? {};
      const id = v.leadgen_id != null ? String(v.leadgen_id).trim() : "";
      if (!/^\d{1,30}$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      const ref: LeadgenRef = { leadgen_id: id };
      const page = v.page_id ?? entry?.id;
      if (page != null) ref.page_id = String(page);
      if (v.form_id != null) ref.form_id = String(v.form_id);
      if (v.ad_id != null) ref.ad_id = String(v.ad_id);
      if (Number.isFinite(Number(v.created_time))) ref.created_time = Number(v.created_time);
      out.push(ref);
    }
  }
  return out;
}

// -------------------------------------------------------------- Graph lead

export interface GraphFieldData {
  name: string;
  values?: unknown[];
}

export interface GraphLead {
  id?: string;
  created_time?: string;
  field_data?: GraphFieldData[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  form_name?: string;
  platform?: string;
}

/** The ad / form lookups used when the lead itself carries no names. */
export function needsNameLookup(g: GraphLead): { ad: boolean; form: boolean } {
  return {
    ad: !!g.ad_id && (!g.ad_name || !g.adset_name || !g.campaign_name),
    form: !!g.form_id && !g.form_name,
  };
}

/** GET /{ad_id}?fields=name,adset{name},campaign{name} */
export function applyAdInfo(g: GraphLead, ad: any): GraphLead {
  if (!ad || typeof ad !== "object") return g;
  return {
    ...g,
    ad_name: g.ad_name || ad.name || undefined,
    adset_name: g.adset_name || ad.adset?.name || undefined,
    campaign_name: g.campaign_name || ad.campaign?.name || undefined,
  };
}

/** GET /{form_id}?fields=name */
export function applyFormInfo(g: GraphLead, form: any): GraphLead {
  if (!form || typeof form !== "object") return g;
  return { ...g, form_name: g.form_name || form.name || undefined };
}

/** Graph writes "2026-10-05T10:15:30+0000"; not every runtime parses the offset without a colon. */
export function parseGraphTime(s: unknown): number | null {
  if (typeof s !== "string" || !s.trim()) return null;
  const t = Date.parse(s.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isFinite(t) ? t : null;
}

// ------------------------------------------------------------------ mapping

interface Answer {
  /** folded question key: "topik yoki ielts sertifikatingiz bormi?" */
  key: string;
  /** the question as the form names it, for the notes */
  label: string;
  value: string;
}

function answersOf(fieldData: GraphFieldData[] | undefined): Answer[] {
  const out: Answer[] = [];
  for (const f of Array.isArray(fieldData) ? fieldData : []) {
    const name = String(f?.name ?? "").trim();
    const value = (Array.isArray(f?.values) ? f.values : [])
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(", ");
    if (!name || !value) continue;
    out.push({ key: fold(name), label: name.replace(/_/g, " ").replace(/\s+/g, " ").trim(), value });
  }
  return out;
}

const rx = {
  fullName: /^(name|full name|to'?liq ism|ism familiya|ism sharif|fio|f i o|имя|фио)[\s?:.!]*$/,
  nameLike: /(^|\s)(ism|ismingiz|fish|имя|фио)(\s|$)/,
  phone: /(phone|telefon|raqam|nomer|номер|телефон|(^|\s)tel(\s|$))/,
  notPhone: /(sertifikat|certificate|сертификат|pasport|passport|hujjat|паспорт)/,
  email: /(e ?mail|pochta|почта)/,
  cert: /(topik|ielts|toefl|sertifikat|certificate|сертификат)/,
  certValue: /(topik|ielts|toefl)/,
  age: /(^|\s)(yosh|yoshingiz|age|возраст)/,
  region: /(viloyat|region|shahar|city|qayer|manzil|област|город|hudud)/,
  goal: /(maqsad|yo'?nalish|goal|degree|ta'?lim|qiziq|направлен|program|dastur)/,
};

function phoneDigits(p: string | null): number {
  return (p ?? "").replace(/\D/g, "").length;
}

export interface MapDeps {
  /** normalizePhone of _shared/identity.ts */
  normalizePhone: (phone: string | null | undefined) => string | null;
  /** for clamping a created_time in the future; default Date.now() */
  nowMs?: number;
}

/**
 * A Graph API lead -> the row to insert into `leads`.
 *   * the contact: name, phone (normalised), email;
 *   * cert_level / age / city / education_level only when the answer clearly
 *     matches the stored-value lists of the card (_shared/lead-values.ts);
 *   * every other answer is kept, as text, in `notes`;
 *   * the ad attribution: campaign / adset / ad / form names, the ids in `utm`.
 */
export function mapGraphLead(graph: GraphLead, ref: LeadgenRef, deps: MapDeps): Record<string, unknown> {
  const now = deps.nowMs ?? Date.now();
  const answers = answersOf(graph.field_data);
  const used = new Set<Answer>();
  const take = (pred: (a: Answer) => boolean): Answer | undefined => {
    const a = answers.find((x) => !used.has(x) && pred(x));
    if (a) used.add(a);
    return a;
  };

  // --- contact
  let fullName = take((a) => a.key === "full name")?.value;
  if (!fullName) {
    const first = take((a) => a.key === "first name")?.value;
    const last = take((a) => a.key === "last name")?.value;
    fullName = [first, last].filter(Boolean).join(" ") || undefined;
  }
  if (!fullName) fullName = take((a) => rx.fullName.test(a.key) || rx.nameLike.test(a.key))?.value;

  let phone: string | null = null;
  for (const a of answers) {
    if (used.has(a) || !rx.phone.test(a.key) || rx.notPhone.test(a.key)) continue;
    const p = deps.normalizePhone(a.value);
    const digits = phoneDigits(p);
    if (digits >= 9 && digits <= 15) {
      phone = p;
      used.add(a);
      break;
    }
  }

  const email = take((a) => rx.email.test(a.key) && a.value.includes("@"))?.value;

  // --- the card's own fields, only from answers that clearly match
  const row: Record<string, unknown> = {};
  const cert = answers.find((a) => !used.has(a) && (rx.cert.test(a.key) || rx.certValue.test(fold(a.value))) && matchCertificate(a.value));
  if (cert) row.cert_level = matchCertificate(cert.value);
  const age = answers.find((a) => !used.has(a) && rx.age.test(a.key) && matchAge(a.value) != null);
  if (age) row.age = matchAge(age.value);
  const city = answers.find((a) => !used.has(a) && rx.region.test(a.key) && matchRegion(a.value));
  if (city) row.city = matchRegion(city.value);
  const goal = answers.find((a) => !used.has(a) && rx.goal.test(a.key) && matchGoal(a.value));
  if (goal) row.education_level = matchGoal(goal.value);

  // --- everything else, as text
  const rest = answers.filter((a) => !used.has(a));
  const notes = rest.length
    ? ("Meta forma javoblari:\n" + rest.map((a) => `• ${a.label}: ${a.value}`).join("\n")).slice(0, 2000)
    : undefined;

  // --- when, where from
  const created = parseGraphTime(graph.created_time) ?? (ref.created_time != null ? ref.created_time * 1000 : null) ?? now;
  const platform = fold(graph.platform);
  const channel = platform === "ig" || platform.startsWith("insta") ? "Instagram" : platform === "fb" || platform.startsWith("face") ? "Facebook" : undefined;

  const ids: Record<string, string> = {};
  const put = (k: string, v: unknown) => {
    if (v != null && String(v).trim()) ids[k] = String(v).trim();
  };
  put("campaign_id", graph.campaign_id);
  put("adset_id", graph.adset_id);
  put("ad_id", graph.ad_id ?? ref.ad_id);
  put("form_id", graph.form_id ?? ref.form_id);
  put("page_id", ref.page_id);
  put("leadgen_id", ref.leadgen_id);

  const emailName = email ? email.split("@")[0] : "";
  row.full_name = fullName || emailName || phone || `Meta forma ${ref.leadgen_id.slice(-6)}`;
  if (phone) row.phone = phone;
  if (email) row.email = email;
  row.source = "meta_form";
  row.source_id = ref.leadgen_id;
  row.status = "new";
  row.how_heard = "Ijtimoiy tarmoq reklamasi";
  row.first_contact_at = new Date(Math.min(created, now)).toISOString();
  if (channel) row.contact_channel = channel;
  if (graph.campaign_name) row.campaign_name = graph.campaign_name;
  if (graph.adset_name) row.adset_name = graph.adset_name;
  if (graph.ad_name) row.ad_name = graph.ad_name;
  if (graph.form_name) row.form_name = graph.form_name;
  row.utm = ids;
  if (notes) row.notes = notes;
  return row;
}
