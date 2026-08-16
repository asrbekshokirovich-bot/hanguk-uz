import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SeriesPoint } from "@/data/types";
import { formatDate, formatDayMonth } from "@/lib/dates";

/**
 * Chiziqli grafik.
 *
 * Qoidalar:
 *   - bitta oʻq, hech qachon ikkita shkala;
 *   - ikkinchi qator solishtirish uchun — neytral rangda va punktir, chunki u
 *     obyekt emas, fon;
 *   - hover majburiy: HTML grafik interaktiv boʻlishi kerak;
 *   - har bir grafik ostida jadval koʻrinishi bor — rang yagona kanal emas.
 */

export interface ChartSeries {
  key: string;
  label: string;
  points: SeriesPoint[];
  /** `ref` — solishtirish chizigʻi: neytral va punktir. */
  role?: "primary" | "ref";
  /** Zinapoyali chiziq — narx kabi bosqichli qiymatlar uchun. */
  step?: boolean;
}

interface Props {
  series: ChartSeries[];
  height?: number;
  /** Tovar boʻlmagan kunlar — kulrang soya. */
  shadedDates?: string[];
  shadedLabel?: string;
  format?: (value: number) => string;
  title?: string;
  /** Toʻrt grafik bitta vaqt oʻqida hover qilinganda ishlatiladi. */
  hoverIndex?: number | null;
  onHoverIndex?: (index: number | null) => void;
  /** Nol chiziqdan boshlanadimi. Narx uchun — yoʻq. */
  zeroBased?: boolean;
  /** Sana yorliqlari koʻrsatilsinmi (ustma-ust grafiklarda faqat oxirgisida). */
  showDates?: boolean;
  /** Oʻq yorligʻi uchun qisqaroq format — pul kabi uzun qiymatlarda. */
  axisFormat?: (value: number) => string;
  /**
   * Chap oʻq kengligini qatʻiy belgilaydi.
   *
   * Ustma-ust turgan grafiklarda shart: aks holda har biri oʻz yorligʻiga
   * qarab turlicha siljiydi va krossxair chizigʻi bitta vaqt oʻqida turmaydi.
   */
  axisWidth?: number;
}

const PAD = { top: 14, right: 10, bottom: 20 };
/** Monoshirina 10px shriftda bitta belgining taxminiy eni. */
const CHAR_W = 6.1;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export function Chart({
  series,
  height = 150,
  shadedDates,
  shadedLabel = "Tovar boʻlmagan kunlar",
  format = (v) => String(Math.round(v)),
  title,
  hoverIndex,
  onHoverIndex,
  zeroBased = true,
  showDates = true,
  axisFormat,
  axisWidth,
}: Props) {
  const tickFormat = axisFormat ?? format;
  const [ref, width] = useWidth<HTMLDivElement>();
  const [localHover, setLocalHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const active = hoverIndex !== undefined ? hoverIndex : localHover;
  const dates = series[0]?.points.map((p) => p.date) ?? [];
  const n = dates.length;

  const { min, max } = useMemo(() => {
    const values = series.flatMap((s) => s.points.map((p) => p.value));
    if (!values.length) return { min: 0, max: 1 };
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    if (hi === lo) return { min: zeroBased ? 0 : lo * 0.9, max: hi === 0 ? 1 : hi * 1.1 };
    const pad = (hi - lo) * 0.12;
    return { min: zeroBased ? 0 : lo - pad, max: hi + pad };
  }, [series, zeroBased]);

  const ticks = useMemo(() => niceTicks(min, max), [min, max]);

  // Chap chekka yorliqning uzunligiga qarab kengayadi — aks holda "2,0 mln"
  // kabi qiymatlar grafikdan tashqariga chiqib ketadi.
  const padLeft = useMemo(() => {
    if (axisWidth) return axisWidth;
    const longest = Math.max(...ticks.map((t) => tickFormat(t).length), 1);
    return Math.min(96, Math.round(longest * CHAR_W) + 12);
  }, [ticks, tickFormat, axisWidth]);

  const plotW = Math.max(10, width - padLeft - PAD.right);
  const plotH = Math.max(10, height - PAD.top - PAD.bottom);

  const x = useCallback(
    (i: number) => padLeft + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW),
    [n, plotW, padLeft],
  );
  const y = useCallback(
    (v: number) => PAD.top + plotH - ((v - min) / (max - min || 1)) * plotH,
    [min, max, plotH],
  );

  const shaded = useMemo(() => {
    if (!shadedDates?.length) return [];
    const set = new Set(shadedDates);
    const bands: { from: number; to: number }[] = [];
    let start: number | null = null;
    dates.forEach((d, i) => {
      if (set.has(d) && start === null) start = i;
      if (!set.has(d) && start !== null) {
        bands.push({ from: start, to: i - 1 });
        start = null;
      }
    });
    if (start !== null) bands.push({ from: start, to: n - 1 });
    return bands;
  }, [shadedDates, dates, n]);

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left - padLeft;
    const i = n <= 1 ? 0 : Math.round((px / plotW) * (n - 1));
    const clamped = Math.max(0, Math.min(n - 1, i));
    setLocalHover(clamped);
    onHoverIndex?.(clamped);
  };

  const handleLeave = () => {
    setLocalHover(null);
    onHoverIndex?.(null);
  };

  const last = active ?? n - 1;
  const multi = series.length > 1;

  const dateLabelIndexes = useMemo(() => {
    if (n <= 1) return [0];
    const wanted = Math.max(2, Math.min(6, Math.floor(plotW / 95)));
    const step = Math.max(1, Math.floor((n - 1) / (wanted - 1)));
    const out: number[] = [];
    for (let i = 0; i < n; i += step) out.push(i);
    // Oxirgi sana doim koʻrinadi, lekin oldingisi bilan ustma-ust tushmaydi.
    if (out[out.length - 1] !== n - 1) {
      if (n - 1 - out[out.length - 1] < step * 0.7) out.pop();
      out.push(n - 1);
    }
    return out;
  }, [n, plotW]);

  const tooltipLeft = Math.min(Math.max(x(last) + 12, 4), Math.max(4, width - 190));

  return (
    <div>
      {title && (
        <div className="chart-title">
          <span>{title}</span>
          {series[0]?.points[last] && (
            <span className="cur">{format(series[0].points[last].value)}</span>
          )}
        </div>
      )}

      {/* Ikkitadan koʻp qator boʻlsa legenda doim koʻrinadi — identifikatsiya
          hech qachon faqat rangga tayanmaydi. */}
      {multi && (
        <div className="legend">
          {series.map((s) => (
            <span className="item" key={s.key}>
              <span
                className="swatch"
                style={{
                  borderTopColor: s.role === "ref" ? "var(--series-ref)" : "var(--series-1)",
                  borderTopStyle: s.role === "ref" ? "dashed" : "solid",
                }}
              />
              {s.label}
            </span>
          ))}
          {shaded.length > 0 && (
            <span className="item">
              <span
                className="swatch"
                style={{ borderTopColor: "var(--fill)", borderTopWidth: 8 }}
              />
              {shadedLabel}
            </span>
          )}
        </div>
      )}

      <div className="chart-frame" ref={ref}>
        <svg
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title ?? "Grafik"}: ${series.map((s) => s.label).join(", ")}`}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        >
          {/* Tovar boʻlmagan kunlar */}
          {shaded.map((band, i) => (
            <rect
              key={i}
              x={x(band.from)}
              y={PAD.top}
              width={Math.max(2, x(band.to) - x(band.from))}
              height={plotH}
              fill="var(--fill)"
            />
          ))}

          {/* Setka — recessiv */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padLeft}
                x2={padLeft + plotW}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--ln3)"
                strokeWidth={1}
              />
              <text
                x={padLeft - 7}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="var(--ink3)"
                fontFamily="var(--f)"
              >
                {tickFormat(t)}
              </text>
            </g>
          ))}

          {/* Sana yorliqlari */}
          {showDates &&
            dateLabelIndexes.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={height - 5}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                fontSize={10}
                fill="var(--ink3)"
                fontFamily="var(--f)"
              >
                {formatDayMonth(dates[i])}
              </text>
            ))}

          {/* Qatorlar — solishtirish chizigʻi avval chiziladi, u fonda qoladi */}
          {[...series]
            .sort((a, b) => (a.role === "ref" ? -1 : 0) - (b.role === "ref" ? -1 : 0))
            .map((s) => {
              const d = s.points
                .map((p, i) => {
                  const px = x(i);
                  const py = y(p.value);
                  if (i === 0) return `M ${px} ${py}`;
                  if (s.step) return `H ${px} V ${py}`;
                  return `L ${px} ${py}`;
                })
                .join(" ");
              const color = s.role === "ref" ? "var(--series-ref)" : "var(--series-1)";
              // Bir kunlik davrda chiziq chizilmaydi — bitta nuqta koʻrsatiladi,
              // aks holda grafik boʻsh boʻlib qoladi.
              if (n === 1) {
                return (
                  <circle
                    key={s.key}
                    cx={x(0)}
                    cy={y(s.points[0]?.value ?? 0)}
                    r={5}
                    fill={color}
                  />
                );
              }
              return (
                <path
                  key={s.key}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={s.role === "ref" ? "6 5" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

          {/* Krossxair */}
          {active !== null && active < n && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--ln2)"
                strokeWidth={1}
              />
              {series.map((s) => {
                const point = s.points[active];
                if (!point) return null;
                return (
                  <circle
                    key={s.key}
                    cx={x(active)}
                    cy={y(point.value)}
                    r={4.5}
                    fill={s.role === "ref" ? "var(--series-ref)" : "var(--series-1)"}
                    stroke="var(--paper)"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {active !== null && active < n && (
          <div className="tooltip" style={{ left: tooltipLeft, top: 4 }}>
            <div className="t-date">{formatDate(dates[active])}</div>
            {series.map((s) => (
              <div className="t-row" key={s.key}>
                <span>{s.label}</span>
                <b>{format(s.points[active]?.value ?? 0)}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 6 }}>
        <button
          type="button"
          className="linkish"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
        >
          {showTable ? "Jadvalni yashirish" : "Jadval koʻrinishi"}
        </button>
      </div>

      {showTable && (
        <div className="table-scroll" style={{ marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Sana</th>
                {series.map((s) => (
                  <th className="num" key={s.key}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => (
                <tr key={d}>
                  <td>{formatDate(d)}</td>
                  {series.map((s) => (
                    <td className="num" key={s.key}>
                      {format(s.points[i]?.value ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
