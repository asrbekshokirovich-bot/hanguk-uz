import { getStatus } from "@/data/api";
import { formatDateTime } from "@/lib/dates";
import { formatPercent } from "@/lib/format";

/**
 * Tizim holati.
 *
 * Sotuvchi ishchi loglarga qaramay tizim ishlayaptimi yoʻqmi shu yerdan
 * koʻrishi kerak: oxirgi sweep qachon boʻlgan, qamrov qancha, xato bormi.
 * Xato boʻlsa u yashirilmaydi — panel raqamlari shunga bogʻliq.
 */
export function StatusBar() {
  const status = getStatus();
  const healthy = status.errors === 0 && status.coveragePercent >= 90;

  return (
    <div className="status">
      <span>
        <span
          className="dot"
          style={{ background: healthy ? "var(--series-1)" : "var(--warn)" }}
          aria-hidden
        />
        Oxirgi sweep: {formatDateTime(status.lastSweepAt)}
      </span>
      <span>Qamrov: {formatPercent(status.coveragePercent, 1)}</span>
      <span className={status.errors > 0 ? "bad" : undefined}>
        Xato: {status.errors}
      </span>
    </div>
  );
}
