import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { type Period, type PeriodId, makePeriod } from "./period";

const VALID: PeriodId[] = ["today", "7d", "30d", "custom"];

/**
 * Davr URL da saqlanadi.
 *
 * Sabab: sotuvchi bosh sahifada "30 kun" ni tanlab, mahsulot sahifasiga
 * oʻtganda davr yana "Bugun" ga qaytsa, u har safar qaytadan tanlashi kerak
 * boʻladi — va sahifalar orasidagi raqamlar bir-biriga mos kelmaydi.
 */
export function usePeriod(): [Period, (id: PeriodId, from?: string, to?: string) => void] {
  const [params, setParams] = useSearchParams();

  const period = useMemo(() => {
    const raw = params.get("davr") as PeriodId | null;
    const id = raw && VALID.includes(raw) ? raw : "today";
    return makePeriod(id, params.get("dan") ?? undefined, params.get("gacha") ?? undefined);
  }, [params]);

  const setPeriod = useCallback(
    (id: PeriodId, from?: string, to?: string) => {
      const next = new URLSearchParams(params);
      next.set("davr", id);
      if (id === "custom") {
        const resolved = makePeriod("custom", from, to);
        next.set("dan", resolved.from);
        next.set("gacha", resolved.to);
      } else {
        next.delete("dan");
        next.delete("gacha");
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  return [period, setPeriod];
}
