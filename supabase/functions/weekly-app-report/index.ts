// weekly-app-report
// ----------------------------------------------------------------------------
// Monday 09:30, Tashkent: the app's last week in five numbers, by the bot, to
// the boss (lead_alert_recipients where watchdog) and to marketing
// (app_report_recipients), with a link to the CRM's Marketing panel — plan
// v2, section 8 «Dushanba 09:30 hisoboti»:
//   1. new active devices (test devices aside),
//   2. requests from the app and their share of all new leads,
//   3. app-involved contracts,
//   4. the channel («Qayerdan topdingiz?») with the most requests,
//   5. the biggest stopping place.
// Each against the week before. The numbers come from analytics_marketing —
// the same SQL as the panel and its Excel/CSV — and the model only writes a
// three-line comment on them; a comment with a number it was not given is
// dropped, not sent.
//
// Called by pg_cron (weekly-app-report, '30 4 * * 1' UTC) with the secret key
// in `apikey`. One report a week: app_weekly_reports keeps the week sent.
// ?dry=1 — hand back the text, send and keep nothing; ?force=1 — send again.
//
// AUTH: verify_jwt is off at the gateway (sb_secret_ keys are not JWTs); the
// caller is checked in authorized(), as in lead-sla-check.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { generateJSON } from "../_shared/gemini.ts";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import {
  aiFacts,
  allowedNumbers,
  biggestStop,
  cleanComment,
  composeReport,
  lastWeek,
  topChannel,
  type Marketing,
  type Week,
} from "./report.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
/** Where the CRM is served; the link opens the Marketing panel. */
const CRM_URL = (Deno.env.get("CRM_URL") || "https://hanguk.uz").replace(/\/+$/, "");

const SYSTEM = `Sen HANGUK Consulting marketing jamoasiga haftalik ilova hisobotiga izoh yozasan.
Kompaniya O'zbekistondan Koreyaga o'qishga yuboradi; ilova — talabalar universitet tanlaydigan va murojaat qoldiradigan ilova.
Senga faqat shu haftaning va oldingi haftaning raqamlari beriladi. Qoidalar:
- Aniq 3 ta qisqa qator yoz (har biri bitta gap, 160 belgigacha), o'zbek tilida, lotin yozuvida.
- 1-qator: shu hafta oldingi haftaga nisbatan nima o'zgardi. 2-qator: odamlar qayerda to'xtayapti. 3-qator: marketing uchun bitta amaliy taklif.
- Raqam yozsang, faqat berilgan raqamni aynan yoz. Farq, foiz yoki boshqa yangi raqam hisoblama. Berilmagan narsani o'ylab topma.
- Kafolat va va'da berma, mubolag'a qilma.`;

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const week = lastWeek(new Date());

  // One report a week: claim the week first, so a second call does nothing.
  if (!dry && !force) {
    const { data, error } = await admin
      .from("app_weekly_reports")
      .upsert({ week_start: week.from }, { onConflict: "week_start", ignoreDuplicates: true })
      .select("week_start");
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data?.length) return json({ ok: true, skipped: "already_sent", week: week.from });
  }
  const release = () => (dry || force ? Promise.resolve() : admin.from("app_weekly_reports").delete().eq("week_start", week.from).is("sent_at", null));

  try {
    const [cur, prev, names] = await Promise.all([
      marketing(admin, week.from, week.to),
      marketing(admin, week.prevFrom, week.prevTo),
      channelNames(admin),
    ]);
    const comment = await aiComment(week, cur, prev, names);
    const text = composeReport({ week, cur, prev, names, comment, link: `${CRM_URL}/crm/app-analytics` });
    if (dry) return json({ ok: true, dry: true, week, text, ai: comment != null });

    const chats = await recipients(admin);
    let sent = 0;
    for (const chat of chats) if (await send(chat, text)) sent++;
    if (!sent) {
      await release();
      console.warn(`weekly-app-report: not delivered (${chats.length} recipient(s))`);
      return json({ ok: false, error: chats.length ? "not_delivered" : "no_recipients", week: week.from });
    }
    const top = topChannel(cur);
    await admin.from("app_weekly_reports").upsert({
      week_start: week.from,
      sent_at: new Date().toISOString(),
      numbers: { kpi: cur.kpi, prev_kpi: prev.kpi, top_channel: top?.key ?? null, stop: biggestStop(cur) },
      comment: comment?.join("\n") ?? null,
      recipients: sent,
    });
    return json({ ok: true, week: week.from, sent, ai: comment != null });
  } catch (e) {
    await release();
    const message = e instanceof Error ? e.message : String(e);
    console.error("weekly-app-report failed:", message);
    return json({ ok: false, error: message }, 500);
  }
});

async function marketing(admin: SupabaseClient, from: string, to: string): Promise<Marketing> {
  const { data, error } = await admin.rpc("analytics_marketing", { p_from: from, p_to: to, p_include_test: false });
  if (error) throw new Error(`analytics_marketing ${from}..${to}: ${error.message}`);
  return data as Marketing;
}

/** «Qayerdan topdingiz?» answers by key. */
async function channelNames(admin: SupabaseClient): Promise<Record<string, string>> {
  const { data, error } = await admin.from("lead_how_heard").select("key, label_uz");
  if (error) console.error("weekly-app-report: channel names:", error.message);
  return Object.fromEntries(((data ?? []) as { key: string; label_uz: string }[]).map((r) => [r.key, r.label_uz]));
}

/** Three lines from the model, or null when it fails or says a number it was not given. */
async function aiComment(week: Week, cur: Marketing, prev: Marketing, names: Record<string, string>): Promise<string[] | null> {
  const facts = aiFacts(week, cur, prev, names);
  const allowed = allowedNumbers(facts);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await generateJSON<{ lines: string[] }>({
        systemInstruction: SYSTEM,
        prompt:
          (attempt ? "Avvalgi javobda berilmagan raqam bor edi. Faqat berilgan raqamlarni ishlat.\n" : "") +
          "Raqamlar (JSON):\n" + JSON.stringify(facts),
        schema: {
          type: "object",
          properties: { lines: { type: "array", items: { type: "string" } } },
          required: ["lines"],
        },
        temperature: 0.2,
      });
      const lines = cleanComment(out?.lines, allowed);
      if (lines) return lines;
    } catch (e) {
      console.error("weekly-app-report: comment:", e instanceof Error ? e.message : e);
      return null;
    }
  }
  console.warn("weekly-app-report: the comment had numbers it was not given — sent without it");
  return null;
}

/** The boss (the owner's watchdog chats) and marketing. */
async function recipients(admin: SupabaseClient): Promise<string[]> {
  const [boss, rest] = await Promise.all([
    admin.from("lead_alert_recipients").select("chat_id").eq("enabled", true).eq("watchdog", true),
    admin.from("app_report_recipients").select("chat_id").eq("enabled", true),
  ]);
  if (boss.error) console.error("weekly-app-report: boss:", boss.error.message);
  if (rest.error) console.error("weekly-app-report: marketing:", rest.error.message);
  const ids = [...(boss.data ?? []), ...(rest.data ?? [])].map((r: { chat_id: string }) => String(r.chat_id).trim());
  return [...new Set(ids.filter(Boolean))];
}

async function send(chatId: string, text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("weekly-app-report: TELEGRAM_BOT_TOKEN not set — not delivered:\n" + text);
    return false;
  }
  const r = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, text);
  return r.ok;
}

/** A secret key in `apikey`, or the service-role key in `Authorization: Bearer`. */
function authorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer !== "" && bearer === SERVICE_KEY;
}

/** Every sb_secret_ key configured for this project, whatever it is named. */
function knownSecretKeys(): string[] {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return [];
    return Object.values(JSON.parse(raw)).filter((v): v is string => typeof v === "string");
  } catch (_e) {
    return [];
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
