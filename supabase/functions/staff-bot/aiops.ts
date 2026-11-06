// Xodim boti AI qatlami ustidagi amallar (reja B0-2, B0-3, B0-5; migratsiya 20261106060000_staff_bot_ai_layer.sql):
//   structured()  — AI so'rovi bot_settings.ai_provider_order tartibi bilan; har urinish ai_calls jadvaliga;
//   enqueue()     — provayderlar xato bergan ish bot_jobs navbatiga (cron `staff-bot-jobs` 5 daqiqada qayta urinadi);
//   splitReport() — kunlik hisobotni 3 qismga ajratish (jonli va navbatdan, `report_split`);
//   runJobs()     — `?action=jobs`: muddati kelgan ishlar, keyin AI holati ogohlantirishi (ownerlarga, soatiga 1 ta);
//   brief()       — 18:15 xulosadagi «🤖 AI (24 soat)» qatori uchun.
// Baza bilan faqat service_role orqali. index.ts faqat createAiOps(...) ni ulaydi va guruh tahlilini beradi.
// Migratsiya hali qo'llanmagan bo'lsa ham bot ishlaydi: jurnal/navbat xatolari faqat loglanadi.

import { type AiAttempt, parseProviderOrder, type Provider, structuredJSON, type StructuredArgs, type StructuredResult } from "./ai.ts";
import { type AiBrief, escapeHtml, type ReportParts, TZ_OFFSET_MIN } from "./core.ts";

/** bot_job_claim/bot_job_finish bilan bir xil: urinish olishda sanaladi, 3-urinish ham xato bo'lsa failed. */
export const JOB_MAX_ATTEMPTS = 3;
/** Ogohlantirish: oxirgi 60 daqiqada kamida 5 chaqiruv va xato ulushi >= 20%. */
export const ALERT_MIN_CALLS = 5;
export const ALERT_ERROR_RATE = 0.2;
const ORDER_TTL_MS = 60_000;
const JOBS_PER_RUN = 10;
// Yangi ish faqat shu vaqt ichida olinadi (bitta ish eng yomoni ~55 s: 2 provayder × (25 s chegara + qayta urinish)).
// Edge vaqt chegarasidan oshib uzilsa ham ish yo'qolmaydi — ijara tugagach qayta olinadi.
const JOBS_BUDGET_MS = 30_000;

export interface DbError { message: string; code?: string }
/** Supabase klientining shu yerda kerak bo'lgan qismi (testda stub). */
export interface Db {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: DbError | null }>;
  from(table: string): { insert(rows: unknown): PromiseLike<{ error: DbError | null }> };
}

export interface JobRow {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
}

/** Ish bajaruvchisi: provayderlar ishlamasa xato matni; muvaffaqiyatda (yoki bajarishga hojat yo'q) — bo'sh. */
export type JobHandler = (job: JobRow) => Promise<string | null | undefined>;

export interface JobsReport {
  done: number;
  retry: number;
  failed: number;
  alert: "none" | "quiet" | "throttled" | "sent";
}

export interface AiOpsDeps {
  db: Db;
  /** bot_settings.ai_provider_order qiymati (index.ts o'qiydi). */
  providerOrder: () => Promise<string | null | undefined>;
  /** Telegram'ga HTML xabar. */
  send: (chatId: number, text: string) => Promise<unknown>;
  /** Test uchun; standart — ai.ts structuredJSON. */
  structured?: typeof structuredJSON;
  now?: () => number;
}

// ── sof yordamchilar ──────────────────────────────────────────────────────

/** Urinishlar → ai_calls qatorlari. */
export function aiCallRows(purpose: string, attempts: AiAttempt[], jobId: string | null = null) {
  return attempts.map((a) => ({
    source: "staff-bot",
    purpose,
    provider: a.provider,
    model: a.model,
    attempt: a.attempt,
    ok: a.ok,
    http_status: a.status,
    error: a.error ? a.error.slice(0, 300) : null,
    latency_ms: Math.round(a.latency_ms),
    input_tokens: a.input_tokens,
    output_tokens: a.output_tokens,
    cost_usd: a.cost_usd,
    job_id: jobId,
  }));
}

export const PURPOSE_UZ: Record<string, string> = {
  group_analysis: "guruh tahlili",
  report_split: "hisobotni ajratish",
};

/** 22:00–08:00 (Toshkent) — ogohlantirish yuborilmaydi; shart saqlansa 08:00 dan keyin boradi. */
export function isQuietHour(nowMs: number): boolean {
  const h = new Date(nowMs + TZ_OFFSET_MIN * 60_000).getUTCHours();
  return h >= 22 || h < 8;
}

export interface AiAlertState {
  /** Oxirgi 60 daqiqa. */
  calls: number;
  errors: number;
  /** Oxirgi ogohlantirishdan beri (ko'pi bilan 24 soat) failed bo'lgan ishlar. */
  failed_jobs: number;
  failed_kinds?: Record<string, number> | null;
  last_error?: { provider?: string | null; status?: number | null; error?: string | null } | null;
}

/** Ogohlantirish matni (HTML) yoki null — kerak emas. */
export function aiAlertText(s: AiAlertState): string | null {
  const calls = Number(s.calls) || 0;
  const errors = Number(s.errors) || 0;
  const failed = Number(s.failed_jobs) || 0;
  const highRate = calls >= ALERT_MIN_CALLS && errors / calls >= ALERT_ERROR_RATE;
  if (!highRate && failed === 0) return null;
  const lines = ["⚠️ <b>AI: nosozlik</b>"];
  if (calls > 0) {
    lines.push(`• Oxirgi 60 daqiqa: ${calls} ta chaqiruv, ${errors} tasi xato (${Math.round((100 * errors) / calls)}%)`);
  }
  if (failed > 0) {
    const kinds = Object.entries(s.failed_kinds ?? {})
      .map(([k, n]) => `${PURPOSE_UZ[k] ?? k}: ${n}`)
      .join(", ");
    lines.push(`• ${JOB_MAX_ATTEMPTS} marta urinib ham bajarilmagan ishlar: ${failed}${kinds ? ` (${escapeHtml(kinds)})` : ""}`);
  }
  const le = s.last_error;
  if (le && (le.error || le.status)) {
    lines.push(`Oxirgi xato: ${escapeHtml(`${le.provider ?? "?"} ${le.status ?? "—"}: ${le.error ?? ""}`.trim())}`);
  }
  lines.push("", "Batafsil: CRM → Sozlamalar → Bot → «AI holati».");
  return lines.join("\n");
}

// ── hisobotni ajratish (avval index.ts da edi) ────────────────────────────

export const REPORT_SPLIT_SYSTEM =
  "You split a staff member's end-of-day work report into three parts. The report is in Uzbek (Latin), " +
  "maybe mixed with Russian. Keep the author's own words and language; shorten only by removing filler. " +
  "Do not invent anything. If a part is not mentioned, return an empty string for it.";

export const REPORT_SPLIT_SCHEMA = {
  type: "object",
  properties: { done: { type: "string" }, blockers: { type: "string" }, plan: { type: "string" } },
  required: ["done", "blockers", "plan"],
};

export const reportSplitPrompt = (raw: string) =>
  `Report:\n"""${raw.slice(0, 6000)}"""\n\nReturn done (what was done today), blockers (problems, blockers, help needed), plan (plans for tomorrow).`;

/** AI qismlarini tozalash; hammasi bo'sh bo'lsa null (ajratiladigan narsa yo'q — bu xato emas). */
export function cleanReportParts(r: Partial<Record<keyof ReportParts, unknown>> | null | undefined): ReportParts | null {
  if (!r) return null;
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 3000) : null);
  const parts = { done: clean(r.done), blockers: clean(r.blockers), plan: clean(r.plan) };
  return parts.done || parts.blockers || parts.plan ? parts : null;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
const first = <T>(data: unknown): T | undefined => (Array.isArray(data) ? data[0] : data ?? undefined) as T | undefined;

// ── amallar ───────────────────────────────────────────────────────────────

export function createAiOps(deps: AiOpsDeps) {
  const { db, send } = deps;
  const run = deps.structured ?? structuredJSON;
  const now = deps.now ?? (() => Date.now());
  let cached: { order: Provider[]; at: number } | null = null;

  /** Provayder tartibi (60 s kesh). O'qib bo'lmasa — standart (claude, gemini). */
  async function order(): Promise<Provider[]> {
    if (cached && now() - cached.at < ORDER_TTL_MS) return cached.order;
    let raw: string | null | undefined = null;
    try {
      raw = await deps.providerOrder();
    } catch (e) {
      console.error("ai_provider_order:", errText(e));
    }
    cached = { order: parseProviderOrder(raw), at: now() };
    return cached.order;
  }

  async function logCalls(purpose: string, attempts: AiAttempt[], jobId: string | null) {
    if (!attempts.length) return;
    try {
      const { error } = await db.from("ai_calls").insert(aiCallRows(purpose, attempts, jobId));
      if (error) console.error("ai_calls:", error.message);
    } catch (e) {
      console.error("ai_calls:", errText(e));
    }
  }

  /** AI so'rovi + jurnal. data=null — provayderlar xato berdi (chaqiruvchi navbatga qo'yadi). */
  async function structured<T>(purpose: string, args: StructuredArgs, jobId: string | null = null): Promise<StructuredResult<T>> {
    const r = await run<T>({ ...args, order: await order() });
    await logCalls(purpose, r.attempts, jobId);
    return r;
  }

  /** Navbatga qo'yish (shu kalit bilan kutilayotgan ish bo'lsa — yangilanadi). */
  async function enqueue(kind: string, key: string, payload: Record<string, unknown>, error: string | null): Promise<string | null> {
    try {
      const { data, error: e } = await db.rpc("bot_job_enqueue", { p_kind: kind, p_key: key, p_payload: payload, p_error: error });
      if (e) { console.error("bot_job_enqueue:", e.message); return null; }
      console.warn(`staff-bot: ${kind} navbatga qo'yildi (${key}): ${error ?? ""}`);
      return (data as string) ?? null;
    } catch (e) {
      console.error("bot_job_enqueue:", errText(e));
      return null;
    }
  }

  /** Hisobotni 3 qismga ajratish. error — provayderlar ishlamadi; parts=null va error=null — AI bo'sh qaytardi. */
  async function splitReport(raw: string, jobId: string | null = null): Promise<{ parts: ReportParts | null; error: string | null }> {
    const r = await structured<ReportParts>("report_split", {
      system: REPORT_SPLIT_SYSTEM,
      prompt: reportSplitPrompt(raw),
      schema: REPORT_SPLIT_SCHEMA,
      temperature: 0,
    }, jobId);
    if (!r.data) return { parts: null, error: r.error ?? "AI xato" };
    return { parts: cleanReportParts(r.data), error: null };
  }

  /** Navbatdagi `report_split`: qayta ajratib, hisobot o'zgarmagan bo'lsa daily_reports'ga yozadi. */
  async function reportJob(job: JobRow): Promise<string | undefined> {
    const raw = typeof job.payload?.raw === "string" ? job.payload.raw : "";
    const reportId = typeof job.payload?.report_id === "string" ? job.payload.report_id : "";
    if (!raw.trim() || !reportId) return; // buzuq ish — yopiladi
    const { parts, error } = await splitReport(raw, job.id);
    if (error) return error;
    if (!parts) return;
    const { error: e } = await db.rpc("bot_report_apply_split", {
      p_report: reportId, p_raw: raw, p_done: parts.done, p_blockers: parts.blockers, p_plan: parts.plan,
    });
    if (e) throw new Error(`bot_report_apply_split: ${e.message}`);
  }

  /** Xulosa oluvchi ownerlarga (bot_owner_chats) DM. Nechtasiga ketganini qaytaradi. */
  async function notifyOwners(text: string): Promise<number> {
    const { data, error } = await db.rpc("bot_owner_chats");
    if (error) { console.error("bot_owner_chats:", error.message); return 0; }
    let sent = 0;
    for (const o of (data ?? []) as { dm_chat_id: number | null }[]) {
      if (!o?.dm_chat_id) continue;
      try {
        await send(o.dm_chat_id, text);
        sent++;
      } catch (e) {
        console.error("ai alert send:", errText(e));
      }
    }
    return sent;
  }

  /** Oxirgi 60 daqiqa xatosi yoki bajarilmay qolgan ishlar bo'lsa ownerlarga DM (soatiga ko'pi bilan 1 ta). */
  async function alertCheck(): Promise<JobsReport["alert"]> {
    const { data, error } = await db.rpc("bot_ai_alert_state");
    if (error || !data) {
      if (error) console.error("bot_ai_alert_state:", error.message);
      return "none";
    }
    const text = aiAlertText(data as AiAlertState);
    if (!text) return "none";
    if (isQuietHour(now())) return "quiet";
    const { data: claimed, error: cErr } = await db.rpc("bot_ai_alert_claim");
    if (cErr) { console.error("bot_ai_alert_claim:", cErr.message); return "none"; }
    if (claimed !== true) return "throttled";
    const n = await notifyOwners(text);
    console.warn(`staff-bot: AI ogohlantirishi ${n} ta ownerga yuborildi`);
    return "sent";
  }

  /** `?action=jobs`: muddati kelgan ishlar (birma-bir, vaqt chegarasi bilan), keyin ogohlantirish tekshiruvi. */
  async function runJobs(handlers: Record<string, JobHandler>): Promise<JobsReport> {
    const all: Record<string, JobHandler> = { report_split: reportJob, ...handlers };
    const t0 = now();
    const rep: JobsReport = { done: 0, retry: 0, failed: 0, alert: "none" };
    for (let i = 0; i < JOBS_PER_RUN && now() - t0 < JOBS_BUDGET_MS; i++) {
      const { data, error } = await db.rpc("bot_job_claim");
      if (error) { console.error("bot_job_claim:", error.message); break; }
      const job = first<JobRow>(data);
      if (!job?.id) break;
      let err: string | null = null;
      try {
        const h = all[job.kind];
        err = h ? (await h(job)) || null : `noma'lum ish turi: ${job.kind}`;
      } catch (e) {
        err = errText(e);
      }
      const { data: fin, error: fErr } = await db.rpc("bot_job_finish", { p_id: job.id, p_ok: !err, p_error: err });
      if (fErr) { console.error("bot_job_finish:", fErr.message); continue; }
      const st = first<{ status: string; attempts: number }>(fin);
      if (st?.status === "done") rep.done++;
      else if (st?.status === "failed") {
        rep.failed++;
        console.error(`staff-bot: ${job.kind} ${st.attempts} urinishdan keyin bajarilmadi: ${err}`);
      } else rep.retry++;
    }
    rep.alert = await alertCheck().catch((e) => {
      console.error("ai alert:", errText(e));
      return "none" as const;
    });
    return rep;
  }

  /** 18:15 xulosa uchun: oxirgi `hours` soatdagi chaqiruv, xato va narx. Bo'lmasa null (qator chiqmaydi). */
  async function brief(hours = 24): Promise<AiBrief | null> {
    try {
      const { data, error } = await db.rpc("bot_ai_stats", { p_hours: hours });
      if (error || !data) {
        if (error) console.error("bot_ai_stats:", error.message);
        return null;
      }
      const s = data as { calls?: unknown; errors?: unknown; cost_usd?: unknown };
      return {
        calls: Number(s.calls) || 0,
        errors: Number(s.errors) || 0,
        cost_usd: s.cost_usd === null || s.cost_usd === undefined ? null : Number(s.cost_usd),
      };
    } catch (e) {
      console.error("bot_ai_stats:", errText(e));
      return null;
    }
  }

  return { order, structured, enqueue, splitReport, reportJob, runJobs, alertCheck, notifyOwners, brief };
}

export type AiOps = ReturnType<typeof createAiOps>;
