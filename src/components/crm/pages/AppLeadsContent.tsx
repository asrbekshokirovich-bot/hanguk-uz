import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AppBriefCard } from "@/components/crm/appLeads/AppBriefCard";
import {
  ROUTE_KEY,
  shortDate,
  useAppLeads,
  waitedLabel,
  type AppLeadRow,
  type Tier,
} from "@/components/crm/appLeads/brief";

const TIER_TONE: Record<Tier, string> = {
  hot: "bg-destructive/10 text-destructive",
  warm: "bg-warning/15 text-warning-foreground dark:text-warning",
  cool: "bg-muted text-muted-foreground",
};
const TIER_EDGE: Record<Tier, string> = {
  hot: "border-l-destructive",
  warm: "border-l-warning",
  cool: "border-l-muted-foreground/40",
};

type Filter = "waiting" | "all";

/**
 * «Ilova lidlari» (Asrbek, 2026-11-03): everyone who came from the student
 * app, those waiting for our answer first — the longest wait on top. Each
 * card opens to what the person did in the app (AppBriefCard) and a ready
 * first message; «Chatni ochish» goes straight to the conversation.
 */
export default function AppLeadsContent() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [days, setDays] = useState(14);
  const [filter, setFilter] = useState<Filter>("waiting");
  const { rows, loading, error, reload } = useAppLeads(days);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const waiting = rows.filter((r) => r.waiting);
  const noChat = rows.filter((r) => !r.thread_id && r.has_phone);
  const shown = useMemo(
    () =>
      filter === "waiting"
        ? rows.filter((r) => r.waiting || (!r.thread_id && r.has_phone))
        : rows,
    [rows, filter]
  );

  // The first three waiting cards start open.
  useEffect(() => {
    setOpen((prev) =>
      prev.size ? prev : new Set(shown.slice(0, 3).map((r) => r.lead_id))
    );
  }, [shown]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4">
      <header className="grid gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          {t("appLeads.title")}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("appLeads.lede")}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
        <Stat
          label={t("appLeads.stat.waiting")}
          value={waiting.length}
          tone={waiting.length ? "bad" : undefined}
        />
        <Stat label={t("appLeads.stat.callBack")} value={noChat.length} />
        <Stat label={t("appLeads.stat.all", { days })} value={rows.length} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["waiting", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-semibold",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-foreground hover:bg-muted"
            )}
          >
            {t(`appLeads.filter.${f}`)}
          </button>
        ))}
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          aria-label={t("appLeads.period")}
        >
          {[3, 7, 14, 30].map((d) => (
            <option key={d} value={d}>
              {t("appLeads.days", { count: d })}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void reload()}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            aria-hidden="true"
          />
          {t("appLeads.refresh")}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        <span
          className={cn(
            "mr-1 rounded px-1.5 py-px font-semibold",
            TIER_TONE.hot
          )}
        >
          {t("appLeads.tier.hot")}
        </span>
        {t("appLeads.tierRule.hot")} ·{" "}
        <span
          className={cn(
            "mx-1 rounded px-1.5 py-px font-semibold",
            TIER_TONE.warm
          )}
        >
          {t("appLeads.tier.warm")}
        </span>
        {t("appLeads.tierRule.warm")} ·{" "}
        <span
          className={cn(
            "mx-1 rounded px-1.5 py-px font-semibold",
            TIER_TONE.cool
          )}
        >
          {t("appLeads.tier.cool")}
        </span>
        {t("appLeads.tierRule.cool")}
      </p>

      {error ? (
        <p className="text-sm text-destructive">
          {/forbidden/i.test(error)
            ? t("appLeads.forbidden")
            : t("appLeads.error")}
        </p>
      ) : loading && !rows.length ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {filter === "waiting"
            ? t("appLeads.emptyWaiting")
            : t("appLeads.empty")}
        </p>
      ) : (
        <ol className="grid gap-3">
          {shown.map((r, i) => (
            <LeadCard
              key={r.lead_id}
              row={r}
              rank={i + 1}
              now={now}
              lang={i18n.language}
              open={open.has(r.lead_id)}
              onToggle={() => toggle(r.lead_id)}
              onChat={() => navigate(`/crm/messages?thread=${r.thread_id}`)}
              onLead={() => navigate(`/crm/leads/${r.lead_id}`)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "bad";
}) {
  return (
    <div className="grid gap-0.5 rounded-xl border border-border bg-card px-3 py-2.5">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-2xl font-extrabold tabular-nums",
          tone === "bad" ? "text-destructive" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function LeadCard({
  row: r,
  rank,
  now,
  lang,
  open,
  onToggle,
  onChat,
  onLead,
}: {
  row: AppLeadRow;
  rank: number;
  now: number;
  lang: string;
  open: boolean;
  onToggle: () => void;
  onChat: () => void;
  onLead: () => void;
}) {
  const { t } = useTranslation();
  const tier: Tier = (["hot", "warm", "cool"] as Tier[]).includes(r.tier)
    ? r.tier
    : "cool";
  return (
    <li
      className="overflow-hidden rounded-xl border border-border bg-card"
      data-testid="app-lead"
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-[6px] px-4 py-3",
          TIER_EDGE[tier]
        )}
      >
        <span className="min-w-[1.5rem] text-2xl font-extrabold text-muted-foreground">
          {rank}
        </span>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-bold uppercase",
            TIER_TONE[tier]
          )}
        >
          {t(`appLeads.tier.${tier}`)}
        </span>
        <span className="min-w-0 max-w-[16rem] truncate font-semibold text-foreground">
          {r.name || "—"}
        </span>
        {r.link_code && (
          <span className="font-mono text-xs text-muted-foreground">
            {r.link_code.slice(0, 6).toUpperCase()}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            {r.channel ?? "—"} ·{" "}
            {r.has_phone ? (
              t("appLeads.hasPhone")
            ) : (
              <b className="text-foreground">{t("appLeads.noPhone")}</b>
            )}
          </span>
          {r.waiting ? (
            <span className="font-semibold text-destructive">
              {t("appLeads.waited", {
                time: waitedLabel(r.last_incoming_at, now, t),
              })}
            </span>
          ) : !r.thread_id && r.has_phone ? (
            <span className="font-semibold text-warning-foreground dark:text-warning">
              {t("appLeads.formNeedsCall")}
            </span>
          ) : r.last_human_out_at ? (
            <span>
              {t("appLeads.answered", {
                when: shortDate(r.last_human_out_at, lang),
              })}
            </span>
          ) : null}
          {r.route && <span>{t(ROUTE_KEY[r.route] ?? r.route)}</span>}
          {r.picks?.length ? <span>♥ {r.picks.join(", ")}</span> : null}
          {r.last_seen_at && (
            <span>
              {t("appLeads.lastSeen", {
                when: shortDate(r.last_seen_at, lang),
              })}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {r.thread_id ? (
            <button
              type="button"
              onClick={onChat}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              {t("appLeads.openChat")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onLead}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {t("appLeads.openLead")}
            </button>
          )}
          {r.thread_id && (
            <button
              type="button"
              onClick={onLead}
              aria-label={t("appLeads.openLead")}
              className="rounded-md border border-border p-1.5 text-foreground hover:bg-muted"
            >
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? t("appLeads.collapse") : t("appLeads.expand")}
            className="rounded-md border border-border p-1.5 text-foreground hover:bg-muted"
          >
            {open ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border">
          <AppBriefCard leadId={r.lead_id} variant="full" />
        </div>
      )}
    </li>
  );
}
