import { Link, useParams } from "react-router-dom";
import { Chart } from "@/components/Chart";
import { DataTable, type Column } from "@/components/DataTable";
import { PeriodPicker } from "@/components/PeriodPicker";
import { Crumb, EventList, MetricCard, Panel, RankCard } from "@/components/ui";
import { type ShopProductRow, shopView } from "@/data/api";
import { formatInt, formatMoney, formatPrice } from "@/lib/format";
import { usePeriod } from "@/lib/usePeriod";
import { NotFoundPage } from "./NotFound";

export function ShopPage() {
  const { id } = useParams();
  const [period, setPeriod] = usePeriod();
  const view = shopView(Number(id), period);

  if (!view) return <NotFoundPage what="Sotuvchi" />;

  const columns: Column<ShopProductRow>[] = [
    {
      key: "name",
      label: "Mahsulot",
      render: (row) => <Link to={`/mahsulot/${row.product.id}`}>{row.product.name}</Link>,
      sortValue: (row) => row.product.name,
    },
    {
      key: "price",
      label: "Narx",
      numeric: true,
      render: (row) => formatPrice(row.price),
      sortValue: (row) => row.price,
    },
    {
      key: "buyers",
      label: "Xaridor / hafta",
      numeric: true,
      render: (row) => formatInt(row.buyersPerWeek),
      sortValue: (row) => row.buyersPerWeek,
    },
    {
      key: "units",
      label: "Dona (~)",
      numeric: true,
      render: (row) => `~${formatInt(row.units)}`,
      sortValue: (row) => row.units,
    },
    {
      key: "stock",
      label: "Qoldiq",
      numeric: true,
      render: (row) =>
        row.outOfStock ? (
          <span style={{ color: "var(--warn)", fontWeight: 700 }}>tugagan</span>
        ) : (
          formatInt(row.stock)
        ),
      sortValue: (row) => row.stock,
    },
  ];

  return (
    <>
      <Crumb
        items={[
          { label: "Bosh sahifa", to: "/" },
          { label: view.categoryName, to: `/turkum/${view.shop.categoryId}` },
          { label: view.shop.name },
        ]}
      />

      <div className="entity-head">
        <span className="av" aria-hidden>
          {view.shop.name.slice(0, 1)}
        </span>
        <div>
          <h1>{view.shop.name}</h1>
          <div className="subline">
            <span className="id">id {view.shop.id}</span>
            <Link to={`/turkum/${view.shop.categoryId}`}>{view.categoryName}</Link>
            {view.shop.official && <span className="pill">rasmiy doʻkon</span>}
            <span>{formatInt(view.productCount)} ta mahsulot kuzatilyapti</span>
          </div>
        </div>
      </div>

      <PeriodPicker period={period} onChange={setPeriod} />

      <div className="metrics">
        <MetricCard
          label="Buyurtmalar"
          metric={view.orders}
          meta="Shop.ordersQuantity hisoblagichining farqi — tizimdagi eng ishonchli raqam."
        />
        <MetricCard
          label="Aylanma"
          metric={view.revenue}
          format={formatMoney}
          small
          meta="Buyurtma × oʻrtacha narx."
        />
        <RankCard label="Oʻrin" rank={view.rank} />
      </div>

      <Panel
        title="Kunlik grafik"
        hint="Qattiq chiziq — sotuvchi. Punktir — turkumdagi oʻrtacha sotuvchi."
      >
        <Chart
          height={210}
          format={formatInt}
          series={[
            { key: "shop", label: view.shop.name, points: view.daily },
            {
              key: "category",
              label: `${view.categoryName} — oʻrtacha sotuvchi`,
              points: view.categoryDaily,
              role: "ref",
            },
          ]}
        />
        <p className="note-inline">
          Ikki chiziqning masofasi asosiy savolga javob beradi: sotuvchi bozordan yaxshiroqmi,
          yoki bozor bilan birga koʻtarilib-tushyaptimi.
        </p>
      </Panel>

      <Panel title="Nima oʻzgardi" hint="Sana · nima oʻzgardi · qanchaga">
        <EventList events={view.events} />
        <p className="note-inline">
          Bu roʻyxat sabab koʻrsatmaydi — faqat bir vaqtda nima boʻlganini yozadi.
        </p>
      </Panel>

      <Panel title="Mahsulotlar" hint={`${view.products.length} ta · ustun nomini bosib saralang`}>
        <DataTable
          columns={columns}
          rows={view.products}
          initialSort={{ key: "units", dir: "desc" }}
          emptyText="Bu sotuvchida kuzatilayotgan mahsulot yoʻq."
        />
      </Panel>
    </>
  );
}
