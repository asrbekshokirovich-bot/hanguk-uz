import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { search } from "@/data/api";
import type { SearchKind } from "@/data/types";
import { MIN_QUERY_LENGTH } from "@/lib/normalize";
import { formatInt, formatMoney, formatRankShort } from "@/lib/format";

const KINDS: { id: SearchKind; label: string; path: string }[] = [
  { id: "shop", label: "Sotuvchi", path: "/sotuvchi" },
  { id: "product", label: "Mahsulot", path: "/mahsulot" },
  { id: "category", label: "Turkum", path: "/turkum" },
];

/**
 * Qidiruv.
 *
 * Avval tur tanlanadi — "iPhone" soʻzi sotuvchi nomida ham, mahsulot nomida
 * ham uchraydi va aralash roʻyxat foydasiz boʻladi.
 *
 * Solishtirish normalizatsiyadan keyin: lotin/kirill va apostrofning toʻrt xil
 * koʻrinishi bitta soʻzga keltiriladi.
 */
export function SearchPanel() {
  const [kind, setKind] = useState<SearchKind>("shop");
  const [query, setQuery] = useState("");

  const hits = useMemo(() => search(kind, query), [kind, query]);
  const basePath = KINDS.find((k) => k.id === kind)!.path;
  const tooShort = query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH;

  return (
    <div className="panel">
      <header>
        <h2>Qidiruv</h2>
        <span className="hint">Lotin ham, kirill ham — "Oʻzbekiston" va "Узбекистон" bir xil.</span>
      </header>
      <div className="body">
        <div className="chips" role="group" aria-label="Qidiruv turi">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className="chip"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="chips" style={{ marginTop: 10 }}>
          <input
            type="search"
            value={query}
            placeholder={`${KINDS.find((k) => k.id === kind)!.label} nomi...`}
            aria-label="Qidirish"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {tooShort && (
          <p className="note-inline">Kamida {MIN_QUERY_LENGTH} ta harf kiriting.</p>
        )}

        {!tooShort && query.trim().length >= MIN_QUERY_LENGTH && (
          <div className="results">
            {hits.length === 0 ? (
              <p className="empty" style={{ padding: 12 }}>
                Hech narsa topilmadi.
              </p>
            ) : (
              <div className="rows">
                {hits.map((hit, i) => (
                  <Link className="row-link" to={`${basePath}/${hit.id}`} key={hit.id}>
                    <span className="n">{i + 1}</span>
                    <span>
                      <span className="name">{hit.name}</span>
                      <span className="ctx" style={{ display: "block" }}>
                        {hit.context}
                        {hit.rank
                          ? ` · ${formatRankShort(hit.rank.position, hit.rank.outOf)} ${hit.rank.basis}`
                          : ""}
                      </span>
                    </span>
                    <span className="figures">
                      {formatInt(hit.orders)}
                      <span className="sub"> ta · ~{formatMoney(hit.revenue)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <p className="note-inline" style={{ padding: "0 12px 10px" }}>
              Raqamlar 30 kunlik oyna uchun. Buyurtma — aniq, aylanma — taxminiy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
