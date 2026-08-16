import { Link } from "react-router-dom";
import type { ChangeEvent, Metric, Rank } from "@/data/types";
import { formatDayMonth } from "@/lib/dates";
import { formatInt, formatRankShort, withTilde } from "@/lib/format";

/**
 * Aniq / taxminiy belgisi.
 *
 * Har bir raqam yonida turadi. Bu bezak emas: aylanma va qoldiqdan hisoblangan
 * sotuv aniq deb oʻqilsa, butun panel yolgʻon gapiradi.
 */
export function CertaintyTag({ certainty }: { certainty: Metric["certainty"] }) {
  return certainty === "exact" ? (
    <span className="tag-exact" title="Oʻlchovdan bevosita olingan">
      aniq
    </span>
  ) : (
    <span className="tag-approx" title="Hisoblab chiqarilgan — aniq emas">
      taxminiy
    </span>
  );
}

export function MetricCard({
  label,
  metric,
  format = formatInt,
  meta,
  small,
}: {
  label: string;
  metric: Metric;
  format?: (n: number) => string;
  meta?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="metric">
      <div className="label">
        <span>{label}</span>
        <CertaintyTag certainty={metric.certainty} />
      </div>
      <div className={small ? "value small" : "value"}>
        {withTilde(format(metric.value), metric.certainty)}
      </div>
      {metric.note && <div className="meta">{metric.note}</div>}
      {meta && <div className="meta">{meta}</div>}
    </div>
  );
}

/**
 * Oʻrin kartochkasi.
 *
 * Uch narsa yozilishi shart — nima boʻyicha, kimlar orasida, qaysi davrda.
 * Oʻsish/tushish strelkasi yoʻq va boʻlmaydi: ikkinchi oʻlchov yigʻilmagan,
 * shuning uchun oʻrin oʻzgardi deb aytishga asos yoʻq.
 */
export function RankCard({ label, rank }: { label: string; rank: Rank | null }) {
  if (!rank) {
    return (
      <div className="metric">
        <div className="label">{label}</div>
        <div className="value small">—</div>
        <div className="meta">Oʻrin hisoblanmadi — yetarli oʻlchov yoʻq.</div>
      </div>
    );
  }

  return (
    <div className="metric">
      <div className="label">
        <span>{label}</span>
        <span className="tag-exact">aniq</span>
      </div>
      <div className="value">{formatRankShort(rank.position, rank.outOf)}</div>
      <div className="meta">
        <b>{rank.basis}</b> · {rank.scope} · {rank.period}
      </div>
      <div className="meta" style={{ color: "var(--ink3)" }}>
        Oʻzgarish strelkasi yoʻq — taqqoslash uchun ikkinchi oʻlchov yigʻilmagan.
      </div>
    </div>
  );
}

export function Crumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="crumb" aria-label="Yoʻl">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          {i > 0 && <span className="sep"> / </span>}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <header>
        <h2>{title}</h2>
        {hint && <span className="hint">{hint}</span>}
      </header>
      <div className="body">{children}</div>
    </section>
  );
}

/**
 * "Nima oʻzgardi" roʻyxati.
 *
 * Bu yerda sabab yozilmaydi — faqat sana, nima boʻlgani va keyin nima
 * kuzatilgani. Xulosani sotuvchining oʻzi chiqaradi.
 */
export function EventList({ events }: { events: ChangeEvent[] }) {
  if (!events.length) {
    return <p className="empty">Tanlangan davrda sezilarli oʻzgarish qayd etilmagan.</p>;
  }

  return (
    <div className="events">
      {events.map((event, i) => (
        <div className="event" key={`${event.date}-${event.kind}-${i}`}>
          <span className="when">{formatDayMonth(event.date)}</span>
          <span className="what">
            <b>{event.label}</b>
            {event.followUp && <span className="follow">{event.followUp}</span>}
          </span>
          <span className="howmuch">{event.amount}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}
