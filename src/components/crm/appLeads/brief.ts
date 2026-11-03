import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * «Ilova lidlari» (Asrbek, 2026-11-03): what an operator needs to know about a
 * person who writes from the student app — their answers, the universities
 * they liked and opened, where they got stuck and what is still open for
 * them. Read through operator_app_brief / operator_app_leads (migration
 * 20261103130000_operator_app_brief.sql); types.ts predates them.
 */
const db = supabase as unknown as {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type AnswerValue = number | boolean | string | null;

export interface Answer {
  v: AnswerValue;
  at: string;
  /** The other form's answer to the same question, when it differs. */
  other: AnswerValue;
}

export interface BriefUniversity {
  institution_id: string;
  name: string | null;
  name_ko: string | null;
  picked: boolean;
  opens: number;
  last_opened_at: string | null;
  /** The app's admission check for this university, 0–100 (bucketed). */
  admission_score: number | null;
  study_plan_tests: number;
  interview_tests: number;
  next_deadline: string | null;
  closed_at: string | null;
  ielts_min: number | null;
  topik_min: number | null;
}

export interface OpenAdmission {
  institution_id: string;
  name: string | null;
  city: string | null;
  deadline: string;
  ielts_min: number | null;
  topik_min: number | null;
}

export interface AppBrief {
  lead: {
    id: string;
    name: string | null;
    has_phone: boolean;
    channel: string | null;
    link_code: string | null;
    how_heard: string | null;
    for_whom: string | null;
  };
  activity: {
    first_seen_at: string | null;
    last_seen_at: string | null;
    visits: number;
    active_days: number;
    active_s: number | null;
    platform: string | null;
    app_version: string | null;
    ui_lang: string | null;
  };
  answers: Record<string, Answer>;
  /** bakalavr | magistratura | til_kursi, or null when the student did not say. */
  route: string | null;
  visa: {
    band: string;
    low: string | null;
    income: string | null;
    topik: number | null;
  } | null;
  tariff: string | null;
  report_views: number;
  universities: BriefUniversity[];
  filters: Record<string, unknown> | null;
  searches: string[];
  friction: {
    code_not_found: number;
    contact_taps: number;
    contact_channels: string[];
    rage_taps: number;
    app_errors: number;
  };
  open_now: OpenAdmission[];
  ai_summary: string | null;
  ai_starter: string | null;
  ai_fresh: boolean;
}

export type Tier = "hot" | "warm" | "cool";

export interface AppLeadRow {
  lead_id: string;
  name: string | null;
  link_code: string | null;
  channel: string | null;
  has_phone: boolean;
  lead_status: string | null;
  thread_id: string | null;
  last_incoming_at: string | null;
  last_human_out_at: string | null;
  waiting: boolean;
  first_seen_at: string | null;
  last_seen_at: string | null;
  visits: number | null;
  tier: Tier;
  route: string | null;
  tariff: string | null;
  picks: string[] | null;
}

/** The brief of one lead; null when no app device is tied to the lead. */
export function useAppBrief(leadId: string | null | undefined) {
  const [data, setData] = useState<AppBrief | null>(null);
  const [loading, setLoading] = useState(!!leadId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!leadId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void db
      .rpc("operator_app_brief", { p_lead_id: leadId })
      .then(({ data, error }) => {
        if (!alive) return;
        setData(error ? null : (data as AppBrief | null) ?? null);
        setError(error ? error.message : null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [leadId]);

  return { data, loading, error };
}

/** App-tied leads, those waiting for our answer first (longest wait on top). */
export function useAppLeads(days: number) {
  const [rows, setRows] = useState<AppLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.rpc("operator_app_leads", {
      p_days: days,
    });
    setRows(error ? [] : ((data ?? []) as AppLeadRow[]));
    setError(error ? error.message : null);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  return { rows, loading, error, reload: load };
}

/**
 * The ready first message (app-journey-summary, the same one the lead card's
 * «Gapni boshlash» uses). Asked for only when the operator wants it.
 */
export function useStarter(brief: AppBrief | null) {
  const fresh = brief?.ai_fresh ? brief.ai_starter : null;
  const [starter, setStarter] = useState<string | null>(fresh);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setStarter(brief?.ai_fresh ? brief.ai_starter : null);
    setFailed(false);
  }, [brief]);

  const make = useCallback(async () => {
    if (!brief) return;
    setLoading(true);
    setFailed(false);
    const { data, error } = await supabase.functions.invoke(
      "app-journey-summary",
      {
        body: { lead_id: brief.lead.id, force: true },
      }
    );
    const out = data as { starter?: string | null } | null;
    if (error || !out?.starter) setFailed(true);
    else setStarter(out.starter);
    setLoading(false);
  }, [brief]);

  return { starter, loading, failed, make };
}

// ---------------------------------------------------------------- pure helpers

type T = (key: string, opts?: Record<string, unknown>) => string;

const num = (v: AnswerValue | undefined): number | null =>
  typeof v === "number"
    ? v
    : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))
    ? Number(v)
    : null;

const yes = (v: AnswerValue | undefined): boolean | null =>
  typeof v === "boolean" ? v : null;

/** «IELTS 7 · TOPIK yo'q», with the other form's figure when it differs. */
export function languageLine(a: Record<string, Answer>, t: T): string {
  const part = (key: "ielts" | "topik", label: string) => {
    const v = num(a[key]?.v);
    if (v === null) return null;
    if (v <= 0) return t("appLeads.fact.none", { what: label });
    const other = num(a[key]?.other);
    const base = `${label} ${String(v).replace(".", ",")}`;
    return other !== null && other > 0 && other !== v
      ? `${base} ${t("appLeads.fact.otherForm", {
          value: String(other).replace(".", ","),
        })}`
      : base;
  };
  const topikOld =
    yes(a.topik_fresh?.v) === false && (num(a.topik?.v) ?? 0) > 0;
  const parts = [part("ielts", "IELTS"), part("topik", "TOPIK")].filter(
    Boolean
  ) as string[];
  if (topikOld) parts.push(t("appLeads.fact.topikOld"));
  return parts.join(" · ");
}

/** «Rasmiy daromad hujjati bor · homiy: ota-ona · mulk · mashina». */
export function moneyLine(a: Record<string, Answer>, t: T): string {
  const parts: string[] = [];
  const doc = yes(a.income_documented?.v);
  if (doc !== null)
    parts.push(
      t(doc ? "appLeads.fact.incomeDoc" : "appLeads.fact.noIncomeDoc")
    );
  const income = num(a.income?.v);
  if (income !== null)
    parts.push(t(`appLeads.income.${Math.min(Math.max(income, 0), 3)}`));
  const sponsor = num(a.sponsor?.v);
  if (sponsor !== null)
    parts.push(t(`appLeads.sponsor.${Math.min(Math.max(sponsor, 0), 2)}`));
  if ((num(a.property?.v) ?? 0) > 0) parts.push(t("appLeads.fact.property"));
  if ((num(a.car?.v) ?? 0) > 0) parts.push(t("appLeads.fact.car"));
  if ((num(a.business?.v) ?? 0) > 0) parts.push(t("appLeads.fact.business"));
  return parts.join(" · ");
}

/** Visa-risk answers worth raising on the call. */
export function riskLine(a: Record<string, Answer>, t: T): string {
  const parts: string[] = [];
  if (yes(a.visa_refused?.v)) parts.push(t("appLeads.fact.visaRefused"));
  if (yes(a.illegal_relatives?.v))
    parts.push(t("appLeads.fact.illegalRelatives"));
  if (yes(a.legal_relatives?.v)) parts.push(t("appLeads.fact.legalRelatives"));
  if (num(a.korea_before?.v) === 2) parts.push(t("appLeads.fact.overstayed"));
  else if (num(a.korea_before?.v) === 1)
    parts.push(t("appLeads.fact.beenToKorea"));
  return parts.join(" · ");
}

/** Admission today for one university: open until a date, closed, or unknown. */
export function admissionState(
  u: Pick<BriefUniversity, "next_deadline" | "closed_at">
):
  | { kind: "open"; date: string }
  | { kind: "closed"; date: string }
  | { kind: "unknown" } {
  if (u.next_deadline) return { kind: "open", date: u.next_deadline };
  if (u.closed_at) return { kind: "closed", date: u.closed_at };
  return { kind: "unknown" };
}

/** «3 kun» / «5 soat» / «12 daqiqa» since an ISO time. */
export function waitedLabel(iso: string | null, now: number, t: T): string {
  if (!iso) return "—";
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 60) return t("appLeads.wait.min", { count: min });
  const h = Math.round(min / 60);
  if (h < 48) return t("appLeads.wait.hour", { count: h });
  return t("appLeads.wait.day", { count: Math.round(h / 24) });
}

/** «5-noy» style short date. */
export function shortDate(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (lang.startsWith("uz")) {
    const m = [
      "yan",
      "fev",
      "mar",
      "apr",
      "may",
      "iyn",
      "iyl",
      "avg",
      "sen",
      "okt",
      "noy",
      "dek",
    ][d.getMonth()];
    return `${d.getDate()}-${m}`;
  }
  return d.toLocaleDateString(lang, { day: "numeric", month: "short" });
}

export const ROUTE_KEY: Record<string, string> = {
  bakalavr: "appLeads.route.bachelor",
  magistratura: "appLeads.route.master",
  til_kursi: "appLeads.route.language",
  bachelor: "appLeads.route.bachelor",
  master: "appLeads.route.master",
  languageCourse: "appLeads.route.language",
};
