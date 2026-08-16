import { Link } from "react-router-dom";
import { Chart } from "@/components/Chart";
import { PeriodPicker } from "@/components/PeriodPicker";
import { SearchPanel } from "@/components/SearchPanel";
import { MetricCard, Panel } from "@/components/ui";
import { categoriesRanked, marketSummary, shopsRanked } from "@/data/api";
import { formatInt, formatMoney } from "@/lib/format";
import { usePeriod } from "@/lib/usePeriod";

export function HomePage() {
  const [period, setPeriod] = usePeriod();
  const summary = marketSummary(period);
  const topShops = shopsRanked(period).slice(0, 5);
  const topCategories = categoriesRanked(period).slice(0, 5);

  return (
    <>
      <div className="page-head">
        <h1>Bozor</h1>
        <div className="subline">
          Uzum boʻyicha kuzatilayotgan sotuvchilar yigʻindisi · {period.label}
        </div>
      </div>

      <PeriodPicker period={period} onChange={setPeriod} />

      <div className="metrics">
        <MetricCard label="Buyurtmalar" metric={summary.orders} />
        <MetricCard
          label="Aylanma"
          metric={summary.revenue}
          format={formatMoney}
          small
          meta="Dona × narx — kartochkadagi narx boʻyicha hisoblangan."
        />
      </div>

      <SearchPanel />

      <Panel title="Kunlik grafik" hint={`Butun bozor · ${period.label}`}>
        <Chart
          series={[{ key: "orders", label: "Buyurtmalar", points: summary.daily }]}
          height={190}
          format={formatInt}
        />
      </Panel>

      <div className="grid-2">
        <Panel title="Top sotuvchilar" hint="Buyurtma boʻyicha">
          <div className="rows">
            {topShops.map((row, i) => (
              <Link className="row-link" to={`/sotuvchi/${row.shop.id}`} key={row.shop.id}>
                <span className="n">{i + 1}</span>
                <span>
                  <span className="name">{row.shop.name}</span>
                  <span className="ctx" style={{ display: "block" }}>
                    {row.categoryName}
                    {row.shop.official ? " · rasmiy doʻkon" : ""}
                  </span>
                </span>
                <span className="figures">
                  {formatInt(row.orders)}
                  <span className="sub"> ta · ~{formatMoney(row.revenue)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Top turkumlar" hint="Buyurtma boʻyicha">
          <div className="rows">
            {topCategories.map((row, i) => (
              <Link className="row-link" to={`/turkum/${row.category.id}`} key={row.category.id}>
                <span className="n">{i + 1}</span>
                <span>
                  <span className="name">{row.category.name}</span>
                  <span className="ctx" style={{ display: "block" }}>
                    {row.shopCount} sotuvchi kuzatilyapti
                  </span>
                </span>
                <span className="figures">
                  {formatInt(row.orders)}
                  <span className="sub"> ta · ~{formatMoney(row.revenue)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
