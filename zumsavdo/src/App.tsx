import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { StatusBar } from "@/components/StatusBar";
import { HomePage } from "@/pages/Home";
import { ShopPage } from "@/pages/Shop";
import { ProductPage } from "@/pages/Product";
import { CategoryPage } from "@/pages/Category";
import { NotFoundPage } from "@/pages/NotFound";

/**
 * Manzillar id boʻyicha: /sotuvchi/9103, /mahsulot/560305, /turkum/1007.
 * Nomga bogʻlanmaydi — Uzumda nom istalgan kuni oʻzgarishi mumkin, id esa yoʻq.
 */
export function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <span className="mark">Z</span>
            ZumSavdo
          </Link>
          <span className="spacer" />
          <StatusBar />
        </div>
      </header>

      <main className="wrap">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sotuvchi/:id" element={<ShopPage />} />
          <Route path="/mahsulot/:id" element={<ProductPage />} />
          <Route path="/turkum/:id" element={<CategoryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <p className="footnote">
          Buyurtma soni <b>aniq</b> — u <code>Shop.ordersQuantity</code> hisoblagichining farqi.
          Aylanma va sotilgan dona <b>taxminiy</b>: birinchisi dona × narx, ikkinchisi qoldiq
          kamayishidan hisoblanadi va tovar oraliqda keltirilsa sotuvning bir qismi koʻrinmay
          qoladi. Panel hech qayerda sabab daʻvo qilmaydi — faqat bir vaqtda nima boʻlganini
          koʻrsatadi.
        </p>
      </main>
    </>
  );
}
