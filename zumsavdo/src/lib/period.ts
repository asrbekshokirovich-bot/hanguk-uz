import { DATA_START, addDays, daysBetween, today } from "./dates";

export type PeriodId = "today" | "7d" | "30d" | "custom";

export interface Period {
  id: PeriodId;
  from: string;
  to: string;
  /** "Bugun", "7 kun", "28.07.2026 — 05.08.2026" — sarlavhalarda ishlatiladi. */
  label: string;
}

export const PERIOD_CHOICES: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Bugun" },
  { id: "7d", label: "7 kun" },
  { id: "30d", label: "30 kun" },
  { id: "custom", label: "Sana tanlash" },
];

/** Davr hech qachon maʻlumot boshlanishidan orqaga chiqmaydi. */
function clampFrom(from: string): string {
  return from < DATA_START ? DATA_START : from;
}

export function makePeriod(id: PeriodId, from?: string, to?: string): Period {
  const end = today();
  switch (id) {
    case "today":
      return { id, from: end, to: end, label: "Bugun" };
    case "7d":
      return { id, from: clampFrom(addDays(end, -6)), to: end, label: "7 kun" };
    case "30d":
      return { id, from: clampFrom(addDays(end, -29)), to: end, label: "30 kun" };
    case "custom": {
      const f = clampFrom(from ?? addDays(end, -6));
      const t = (to ?? end) > end ? end : (to ?? end);
      return {
        id,
        from: f,
        to: t < f ? f : t,
        label: `${f} — ${t}`,
      };
    }
  }
}

export function defaultPeriod(): Period {
  return makePeriod("today");
}

/** Davrdagi kunlar soni. */
export function periodDays(p: Period): number {
  return daysBetween(p.from, p.to) + 1;
}

/**
 * Oʻrin va reyting doim 30 kunlik oynada hisoblanadi — davr tugmasi buni
 * oʻzgartirmaydi, chunki qisqa oynada oʻrin shovqinga aylanadi.
 */
export const RANK_WINDOW_DAYS = 30;

export function rankPeriod(): Period {
  return makePeriod("30d");
}
