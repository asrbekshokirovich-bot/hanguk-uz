import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Chart } from "@/components/Chart";
import { PeriodPicker } from "@/components/PeriodPicker";
import { Crumb, EventList, MetricCard, Panel, RankCard } from "@/components/ui";
import { productView } from "@/data/api";
import { formatInt, formatMoney, formatMoneyShort, formatPercent, formatPrice } from "@/lib/format";
import { usePeriod } from "@/lib/usePeriod";
import { NotFoundPage } from "./NotFound";

/**
 * Mahsulot sahifasi — mahsulotning eng muhim joyi.
 *
 * Toʻrtta grafik bitta vaqt oʻqida turadi va hover ular boʻylab birga
 * harakatlanadi. Sotuvchi shu yerda narx tushgan kunni, tovar tugagan kunni va
 * sharhlar oʻsgan kunni bir vertikal chiziqda koʻradi — xulosani panel emas,
 * uning oʻzi chiqaradi.
 */
export function ProductPage() {
  const { id } = useParams();
  const [period, setPeriod] = usePeriod();
  const [hover, setHover] = useState<number | null>(null);
  const view = productView(Number(id), period);

  if (!view) return <NotFoundPage what="Mahsulot" />;

  const shared = {
    hoverIndex: hover,
    onHoverIndex: setHover,
    height: 130,
    showDates: false,
    // Toʻrtala grafikning chap oʻqi bir xil kenglikda — shundagina vertikal
    // chiziq toʻrtalasida aynan bir kunda turadi.
    axisWidth: 64,
  };

  return (
    <>
      <Crumb
        items={[
          { label: "Bosh sahifa", to: "/" },
          { label: view.shop.name, to: `/sotuvchi/${view.shop.id}` },
          { label: view.categoryName, to: `/turkum/${view.product.categoryId}` },
          { label: view.product.name },
        ]}
      />

      <div className="entity-head">
        <span className="av" aria-hidden>
          {view.product.name.slice(0, 1)}
        </span>
        <div>
          <h1>{view.product.name}</h1>
          <div className="subline">
            <span className="id">id {view.product.id}</span>
            <Link to={`/sotuvchi/${view.shop.id}`}>{view.shop.name}</Link>
            <Link to={`/turkum/${view.product.categoryId}`}>{view.categoryName}</Link>
            <span>{formatPrice(view.price)}</span>
            {view.discountPercent > 0 && (
              <span className="pill">chegirma {formatPercent(view.discountPercent)}</span>
            )}
          </div>
        </div>
      </div>

      <PeriodPicker period={period} onChange={setPeriod} />

      <div className="metrics">
        <MetricCard
          label="Xaridorlar / hafta"
          metric={view.buyersPerWeek}
          meta={
            <>
              Bu <b>odam</b> soni — buyurtma ham, dona ham emas. Manba: kartochkadagi "Bu haftada
              N kishi sotib oldi". Davr tugmasi buni oʻzgartirmaydi.
            </>
          }
        />
        <MetricCard
          label="Sotuv (dona)"
          metric={view.units}
          meta="Qoldiq kamayishidan. Oraliqda tovar keltirilsa, sotuvning bir qismi koʻrinmaydi."
        />
        <RankCard label="Oʻrin" rank={view.rank} />
      </div>

      <Panel
        title="Toʻrt grafik — bitta vaqt oʻqi"
        hint="Sichqonchani yuriting: vertikal chiziq toʻrtalasida birga harakatlanadi."
      >
        {view.outOfStockDates.length > 0 && (
          <div className="callout warn" style={{ marginBottom: 12 }}>
            Kulrang soya — tovar boʻlmagan kunlar ({view.outOfStockDates.length} kun). Bu kunlarda
            sotuv nolga tushadi, chunki sotadigan narsa qolmagan.
          </div>
        )}

        <div className="charts-4">
          <Chart
            {...shared}
            title="Sotuv (dona, taxminiy)"
            series={[{ key: "sold", label: "Dona", points: view.series.sold }]}
            shadedDates={view.outOfStockDates}
            format={formatInt}
          />
          <Chart
            {...shared}
            title="Narx"
            series={[{ key: "price", label: "Narx", points: view.series.price, step: true }]}
            format={formatMoney}
            axisFormat={formatMoneyShort}
            zeroBased={false}
          />
          <Chart
            {...shared}
            title="Qoldiq"
            series={[{ key: "stock", label: "Qoldiq", points: view.series.stock }]}
            shadedDates={view.outOfStockDates}
            format={formatInt}
          />
          <Chart
            {...shared}
            title="Sharhlar (jamlanma)"
            series={[{ key: "reviews", label: "Sharhlar", points: view.series.reviews }]}
            format={formatInt}
            zeroBased={false}
            showDates
          />
        </div>
      </Panel>

      <Panel title="Nima oʻzgardi" hint="Sana · hodisa · raqam">
        <EventList events={view.events} />
        <p className="note-inline">
          Qatorlarda "sababi shu" deb yozilmaydi. Narx tushgani va donaning oshgani bir vaqtda
          sodir boʻlgan — bogʻliqligini sotuvchi oʻzi baholaydi.
        </p>
      </Panel>
    </>
  );
}
