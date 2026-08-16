import { Link, useParams } from "react-router-dom";
import { Chart } from "@/components/Chart";
import { PeriodPicker } from "@/components/PeriodPicker";
import { Crumb, MetricCard, Panel } from "@/components/ui";
import { categoryView } from "@/data/api";
import { formatInt, formatMoney, formatPercent, formatPrice } from "@/lib/format";
import { usePeriod } from "@/lib/usePeriod";
import { NotFoundPage } from "./NotFound";

export function CategoryPage() {
  const { id } = useParams();
  const [period, setPeriod] = usePeriod();
  const view = categoryView(Number(id), period);

  if (!view) return <NotFoundPage what="Turkum" />;

  const known = view.verdict.difficulty !== "nomaʻlum";

  return (
    <>
      <Crumb items={[{ label: "Bosh sahifa", to: "/" }, { label: view.category.name }]} />

      <div className="entity-head">
        <span className="av" aria-hidden>
          {view.category.name.slice(0, 1)}
        </span>
        <div>
          <h1>{view.category.name}</h1>
          <div className="subline">
            <span className="id">id {view.category.id}</span>
            <span>{formatInt(view.productCount)} ta mahsulot</span>
            <span>{formatInt(view.shopCount)} ta sotuvchi</span>
          </div>
        </div>
      </div>

      <PeriodPicker period={period} onChange={setPeriod} />

      <div className="metrics">
        <MetricCard
          label="Buyurtmalar"
          metric={view.orders}
          meta="Turkumdagi kuzatilayotgan sotuvchilar yigʻindisi."
        />
        <MetricCard label="Aylanma" metric={view.revenue} format={formatMoney} small />
        <MetricCard
          label="Raqobat"
          metric={{ value: view.competition, certainty: "approx" }}
          format={(v) => `${v.toFixed(1)} buyurtma`}
          small
          meta="Bitta mahsulotga toʻgʻri keladigan buyurtma. Raqam qancha past boʻlsa, mahsulotlar shuncha koʻp va buyurtma shuncha tarqoq."
        />
      </div>

      <Panel title="Xulosa" hint="Bu turkumga kirish qanchalik ogʻir">
        {known ? (
          <>
            <div className="verdict">Kirish {view.verdict.difficulty}</div>
            <p style={{ margin: "6px 0 0", color: "var(--ink2)" }}>{view.verdict.reason}</p>
            {view.verdict.topFiveShare !== null && (
              <p className="note-inline">
                Top 5 sotuvchi barcha buyurtmaning{" "}
                <b>{formatPercent(view.verdict.topFiveShare * 100)}</b> ini oladi ·{" "}
                {view.shopCount} ta sotuvchi kuzatilyapti.
              </p>
            )}
          </>
        ) : (
          <div className="callout">
            <b>Xulosa chiqarilmadi.</b> {view.verdict.reason}
          </div>
        )}
      </Panel>

      <Panel title="Kunlik grafik" hint={`Turkum boʻyicha jami · ${period.label}`}>
        <Chart
          height={180}
          format={formatInt}
          series={[{ key: "orders", label: "Buyurtmalar", points: view.daily }]}
        />
      </Panel>

      <div className="grid-2">
        <Panel title="Sotuvchilar" hint="Buyurtma va ulush boʻyicha">
          <div className="rows">
            {view.shops.map((row, i) => (
              <Link className="row-link" to={`/sotuvchi/${row.shop.id}`} key={row.shop.id}>
                <span className="n">{i + 1}</span>
                <span>
                  <span className="name">{row.shop.name}</span>
                  <span className="ctx" style={{ display: "block" }}>
                    {view.orders.value > 0
                      ? `ulush ${formatPercent((row.orders / view.orders.value) * 100, 1)}`
                      : "ulush hisoblanmadi"}
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

        <Panel title="Mahsulotlar" hint="Sotilgan dona boʻyicha (taxminiy)">
          <div className="rows">
            {view.products.slice(0, 10).map((row, i) => (
              <Link className="row-link" to={`/mahsulot/${row.product.id}`} key={row.product.id}>
                <span className="n">{i + 1}</span>
                <span>
                  <span className="name">{row.product.name}</span>
                  <span className="ctx" style={{ display: "block" }}>
                    {row.shopName}
                  </span>
                </span>
                <span className="figures">
                  ~{formatInt(row.units)}
                  <span className="sub"> dona · {formatPrice(row.price)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
