import { useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  numeric?: boolean;
  render: (row: T) => React.ReactNode;
  /** Saralash qiymati. Berilmasa ustun saralanmaydi. */
  sortValue?: (row: T) => number | string;
}

/**
 * Saralanadigan jadval.
 *
 * Sotuvchi oʻz mahsulotlarini har xil savol bilan koʻradi: qaysi biri koʻp
 * sotildi, qaysi birining qoldigʻi tugayapti, qaysi biri qimmat. Shuning uchun
 * saralash ustunlar boʻyicha ochiq.
 */
export function DataTable<T>({
  columns,
  rows,
  initialSort,
  emptyText = "Maʻlumot yoʻq.",
}: {
  columns: Column<T>[];
  rows: T[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  emptyText?: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), "uz") * factor;
    });
  }, [rows, sort, columns]);

  const toggle = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );
  };

  if (!rows.length) return <p className="empty">{emptyText}</p>;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  className={[column.numeric ? "num" : "", column.sortValue ? "sortable" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                  onClick={column.sortValue ? () => toggle(column.key) : undefined}
                >
                  {column.label}
                  {active ? (sort!.dir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? "num" : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
