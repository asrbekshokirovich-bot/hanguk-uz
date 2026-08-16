import { dataStart, formatDate, today } from "@/lib/dates";
import { PERIOD_CHOICES, type Period, type PeriodId } from "@/lib/period";

/**
 * Davr tanlash.
 *
 * Eng eski oʻlchovdan oldingi sanalar oʻchirilgan — undan oldin hech narsa
 * yigʻilmagan. Ularni ochiq qoldirish "nol buyurtma" degan yolgʻon javob beradi.
 */
export function PeriodPicker({
  period,
  onChange,
}: {
  period: Period;
  onChange: (id: PeriodId, from?: string, to?: string) => void;
}) {
  const max = today();

  return (
    <div className="panel">
      <header>
        <h2>Davr</h2>
        <span className="hint">
          Maʻlumot {formatDate(dataStart())} dan yigʻilgan — undan oldingi sanalar mavjud emas.
        </span>
      </header>
      <div className="body">
        <div className="chips" role="group" aria-label="Davr">
          {PERIOD_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className="chip"
              aria-pressed={period.id === choice.id}
              onClick={() => onChange(choice.id, period.from, period.to)}
            >
              {choice.label}
            </button>
          ))}
        </div>

        {period.id === "custom" && (
          <div className="date-inputs">
            <label>
              <span className="sr-only">Boshlanish sanasi</span>
              <input
                type="date"
                value={period.from}
                min={dataStart()}
                max={max}
                onChange={(e) => onChange("custom", e.target.value, period.to)}
              />
            </label>
            <span>—</span>
            <label>
              <span className="sr-only">Tugash sanasi</span>
              <input
                type="date"
                value={period.to}
                min={dataStart()}
                max={max}
                onChange={(e) => onChange("custom", period.from, e.target.value)}
              />
            </label>
          </div>
        )}

        {period.id === "today" && (
          <p className="note-inline">
            Bugungi kun toʻliq emas: sweeplar kun davomida tushadi, shuning uchun raqam kun
            oxirigacha oʻsib boradi.
          </p>
        )}
      </div>
    </div>
  );
}
