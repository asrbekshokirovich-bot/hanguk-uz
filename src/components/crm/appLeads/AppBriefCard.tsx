import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, Heart, Loader2, Smartphone, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ROUTE_KEY,
  admissionState,
  languageLine,
  moneyLine,
  riskLine,
  shortDate,
  useAppBrief,
  useStarter,
  type AppBrief,
  type BriefUniversity,
} from "./brief";

/**
 * What the person did in the student app, for the operator who answers them
 * (Asrbek, 2026-11-03): who they are by their own answers, the universities
 * they liked (♥) and opened — each with today's admission state — what is
 * still open for their route and language, where they got stuck, and a
 * ready first message. `rail` is the narrow block in Xabarlar; `full` is a
 * card on «Ilova lidlari».
 */
export function AppBriefCard({
  leadId,
  variant,
}: {
  leadId: string;
  variant: "rail" | "full";
}) {
  const { t } = useTranslation();
  const { data, loading, error } = useAppBrief(leadId);

  if (loading) {
    return (
      <p className="flex items-center gap-2 px-1 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {t("appLeads.loading")}
      </p>
    );
  }
  if (error)
    return (
      <p className="px-1 py-3 text-xs text-destructive">
        {t("appLeads.error")}
      </p>
    );
  if (!data) {
    return variant === "rail" ? null : (
      <p className="px-1 py-3 text-xs text-muted-foreground">
        {t("appLeads.noApp")}
      </p>
    );
  }
  return variant === "rail" ? (
    <RailBrief brief={data} />
  ) : (
    <FullBrief brief={data} />
  );
}

function Facts({ brief, dense }: { brief: AppBrief; dense?: boolean }) {
  const { t, i18n } = useTranslation();
  const a = brief.answers;
  const rows: [string, string][] = [];
  const age = a.age?.v;
  if (age !== undefined && age !== null)
    rows.push([t("appLeads.row.age"), String(age)]);
  const route = brief.route ?? (a.route?.v ? String(a.route.v) : null);
  rows.push([
    t("appLeads.row.route"),
    route ? t(ROUTE_KEY[route] ?? route) : t("appLeads.route.unknown"),
  ]);
  const lang = languageLine(a, t);
  if (lang) rows.push([t("appLeads.row.language"), lang]);
  if (a.gpa?.v !== undefined && a.gpa?.v !== null)
    rows.push([t("appLeads.row.gpa"), String(a.gpa.v).replace(".", ",")]);
  const money = moneyLine(a, t);
  if (money) rows.push([t("appLeads.row.money"), money]);
  const risk = riskLine(a, t);
  if (risk) rows.push([t("appLeads.row.risk"), risk]);
  if (brief.visa) {
    const low = brief.visa.low
      ? t(`appLeads.low.${brief.visa.low}`, { defaultValue: brief.visa.low })
      : null;
    rows.push([
      t("appLeads.row.visaTest"),
      [
        t(`appLeads.band.${brief.visa.band}`, {
          defaultValue: brief.visa.band,
        }),
        low ? t("appLeads.weakest", { what: low }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ]);
  }
  if (brief.tariff)
    rows.push([
      t("appLeads.row.tariff"),
      t(`appLeads.tariff.${brief.tariff}`, { defaultValue: brief.tariff }),
    ]);
  const act = brief.activity;
  rows.push([
    t("appLeads.row.activity"),
    [
      t("appLeads.visits", { count: act.visits }),
      act.active_s
        ? t("appLeads.minutes", {
            count: Math.max(1, Math.round(act.active_s / 60)),
          })
        : null,
      act.last_seen_at
        ? t("appLeads.lastSeen", {
            when: shortDate(act.last_seen_at, i18n.language),
          })
        : null,
      act.platform === "ios"
        ? "iPhone"
        : act.platform === "android"
        ? "Android"
        : act.platform,
    ]
      .filter(Boolean)
      .join(" · "),
  ]);

  return (
    <dl
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3",
        dense ? "gap-y-1 text-xs" : "gap-y-1.5 text-[13px]"
      )}
    >
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="whitespace-nowrap text-muted-foreground">{k}</dt>
          <dd className="min-w-0 font-medium text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function UniversityLine({ u }: { u: BriefUniversity }) {
  const { t, i18n } = useTranslation();
  const st = admissionState(u);
  const tests = [
    u.admission_score !== null
      ? t("appLeads.uni.check", { score: u.admission_score })
      : null,
    u.study_plan_tests ? t("appLeads.uni.studyPlan") : null,
    u.interview_tests ? t("appLeads.uni.interview") : null,
  ].filter(Boolean);
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
      <span className="flex items-center gap-1 font-semibold text-foreground">
        {u.picked && (
          <Heart
            className="h-3 w-3 fill-destructive text-destructive"
            aria-label={t("appLeads.uni.picked")}
          />
        )}
        {u.name ?? u.name_ko ?? "—"}
      </span>
      {st.kind === "open" && (
        <span className="rounded bg-success/10 px-1.5 py-px text-[11px] font-semibold text-success">
          {t("appLeads.uni.openUntil", {
            date: shortDate(st.date, i18n.language),
          })}
        </span>
      )}
      {st.kind === "closed" && (
        <span className="rounded bg-destructive/10 px-1.5 py-px text-[11px] font-semibold text-destructive">
          {t("appLeads.uni.closed", {
            date: shortDate(st.date, i18n.language),
          })}
        </span>
      )}
      {st.kind === "unknown" && (
        <span className="text-[11px] text-muted-foreground">
          {t("appLeads.uni.noDates")}
        </span>
      )}
      <span className="text-[11px] text-muted-foreground">
        {[
          u.opens ? t("appLeads.uni.opens", { count: u.opens }) : null,
          ...tests,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </li>
  );
}

function OpenNow({ brief }: { brief: AppBrief }) {
  const { t, i18n } = useTranslation();
  if (!brief.open_now.length)
    return (
      <p className="text-xs text-muted-foreground">
        {t("appLeads.openNowNone")}
      </p>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {brief.open_now.map((o) => (
        <span
          key={o.institution_id}
          className="whitespace-nowrap rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-foreground"
          title={[
            o.city,
            o.ielts_min ? `IELTS ${o.ielts_min}` : null,
            o.topik_min ? `TOPIK ${o.topik_min}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {o.name}{" "}
          <b className="font-mono">{shortDate(o.deadline, i18n.language)}</b>
        </span>
      ))}
    </div>
  );
}

function Friction({ brief }: { brief: AppBrief }) {
  const { t } = useTranslation();
  const f = brief.friction;
  const notes: string[] = [];
  if (f.code_not_found)
    notes.push(
      t("appLeads.friction.codeNotFound", { count: f.code_not_found })
    );
  if (f.contact_taps)
    notes.push(t("appLeads.friction.contactTaps", { count: f.contact_taps }));
  if (!brief.lead.has_phone) notes.push(t("appLeads.friction.noPhone"));
  if (brief.searches.length)
    notes.push(
      t("appLeads.friction.searched", {
        what: brief.searches.slice(0, 4).join(", "),
      })
    );
  const filters = brief.filters as {
    degree?: string;
    regions?: string;
    topik?: string;
  } | null;
  if (filters?.regions || filters?.degree) {
    notes.push(
      t("appLeads.friction.filtered", {
        what: [
          filters.degree && filters.degree !== "all" ? filters.degree : null,
          filters.regions,
        ]
          .filter(Boolean)
          .join(" · "),
      })
    );
  }
  if (!notes.length) return null;
  return (
    <ul className="grid gap-1 text-xs text-muted-foreground">
      {notes.map((n) => (
        <li key={n}>• {n}</li>
      ))}
    </ul>
  );
}

function Starter({ brief }: { brief: AppBrief }) {
  const { t } = useTranslation();
  const { starter, loading, failed, make } = useStarter(brief);
  const copy = async () => {
    if (!starter) return;
    try {
      await navigator.clipboard.writeText(starter);
      toast.success(t("appLeads.copied"));
    } catch {
      toast.error(t("appLeads.copyFailed"));
    }
  };
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {t("appLeads.starterTitle")}
        </span>
        <div className="flex gap-1.5">
          {starter && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md border border-primary px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <Copy className="h-3 w-3" aria-hidden="true" />
              {t("appLeads.copy")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void make()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3 w-3" aria-hidden="true" />
            )}
            {starter ? t("appLeads.starterAgain") : t("appLeads.starterMake")}
          </button>
        </div>
      </div>
      {starter && (
        <p className="whitespace-pre-wrap rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-[13px] leading-relaxed text-foreground">
          {starter}
        </p>
      )}
      {failed && (
        <p className="text-xs text-destructive">
          {t("appLeads.starterFailed")}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

function RailBrief({ brief }: { brief: AppBrief }) {
  const { t } = useTranslation();
  return (
    <section
      className="grid gap-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-3"
      aria-label={t("appLeads.railTitle")}
    >
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
        <Smartphone className="h-4 w-4 text-primary" aria-hidden="true" />
        {t("appLeads.railTitle")}
      </h3>
      <Facts brief={brief} dense />
      {brief.universities.length > 0 && (
        <Section title={t("appLeads.universitiesTitle")}>
          <ul className="grid gap-1">
            {brief.universities.slice(0, 5).map((u) => (
              <UniversityLine key={u.institution_id} u={u} />
            ))}
          </ul>
        </Section>
      )}
      <Section title={t("appLeads.openNowTitle")}>
        <OpenNow brief={brief} />
      </Section>
      <Friction brief={brief} />
      <p className="text-[11px] italic text-muted-foreground">
        {t("appLeads.privacyHint")}
      </p>
      <Starter brief={brief} />
    </section>
  );
}

function FullBrief({ brief }: { brief: AppBrief }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-0 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="min-w-0 border-b border-border bg-muted/40 p-4 md:border-b-0 md:border-r">
        <Facts brief={brief} />
      </div>
      <div className="grid min-w-0 content-start gap-4 p-4">
        <Section title={t("appLeads.universitiesTitle")}>
          {brief.universities.length ? (
            <ul className="grid gap-1.5">
              {brief.universities.map((u) => (
                <UniversityLine key={u.institution_id} u={u} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("appLeads.noUniversities")}
            </p>
          )}
        </Section>
        <Section title={t("appLeads.openNowTitle")}>
          <OpenNow brief={brief} />
        </Section>
        <Friction brief={brief} />
      </div>
      <div className="grid gap-2 border-t border-border p-4 md:col-span-2">
        <Starter brief={brief} />
        <p className="text-[11px] italic text-muted-foreground">
          {t("appLeads.privacyHint")}
        </p>
      </div>
    </div>
  );
}
