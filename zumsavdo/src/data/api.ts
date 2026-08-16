import { daysBetween } from "@/lib/dates";
import { type Period, rankPeriod } from "@/lib/period";
import { MIN_QUERY_LENGTH, matchScore } from "@/lib/normalize";
import { getDataset, productEvents, shopEvents } from "./dataset";
import type {
  Category,
  ChangeEvent,
  Metric,
  Product,
  ProductDay,
  Rank,
  SearchHit,
  SearchKind,
  SeriesPoint,
  Shop,
  ShopDay,
  SweepStatus,
} from "./types";

/**
 * Soʻrov qatlami.
 *
 * Sahifalar faqat shu funksiyalarni biladi. Sweep qiluvchi haqiqiy backend
 * ulanganda bu fayl HTTP chaqiruvlariga aylanadi, sahifalar oʻzgarmaydi.
 */

/**
 * Faol toʻplam har chaqiruvda oʻqiladi — ombor yuklangach u almashadi va
 * modul darajasidagi nusxa eskirib qolmasligi kerak.
 */
function db() {
  return getDataset();
}

/** Davr ichidagi kunlar indekslari. */
function sliceIndexes(period: Period): number[] {
  const first = daysBetween(db().dates[0], period.from);
  const last = daysBetween(db().dates[0], period.to);
  const out: number[] = [];
  for (let i = Math.max(0, first); i <= Math.min(db().dates.length - 1, last); i++) {
    out.push(i);
  }
  return out;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------- holat

export function getStatus(): SweepStatus {
  return db().status;
}

export function getDates(): string[] {
  return db().dates;
}

// ---------------------------------------------------------------- xomashyo

export function getShop(id: number): Shop | undefined {
  return db().shops.find((s) => s.id === id);
}

export function getProduct(id: number): Product | undefined {
  return db().products.find((p) => p.id === id);
}

export function getCategory(id: number): Category | undefined {
  return db().categories.find((c) => c.id === id);
}

export function shopProductCount(shopId: number): number {
  return db().productsByShop.get(shopId)?.length ?? 0;
}

export function categoryCounts(categoryId: number): { products: number; shops: number } {
  return {
    products: db().productsByCategory.get(categoryId)?.length ?? 0,
    shops: db().shopsByCategory.get(categoryId)?.length ?? 0,
  };
}

// ---------------------------------------------------------------- oʻlchovlar

/**
 * Buyurtmalar — ANIQ raqam. `Shop.ordersQuantity` hisoblagichining farqi.
 *
 * "Bugun" tanlanganda kun toʻliq emas: nechta oʻlchov tushgani izohda yoziladi,
 * aks holda tushib qolgan yarim kun oʻsish yoki pasayish deb oʻqiladi.
 */
function ordersMetric(days: ShopDay[], indexes: number[], period: Period): Metric {
  const value = sum(indexes.map((i) => ordersOf(days[i])));
  const notes: string[] = [];

  if (period.id === "today") {
    const last = days[indexes[indexes.length - 1]];
    if (last) notes.push(`${last.sweeps}/${last.sweepsExpected} oʻlchov tushgan`);
  }

  const missing = countMissing(days, indexes);
  if (missing > 0) {
    notes.push(`${missing} kun uchun oʻlchov yetmagan — u yigʻindiga kirmadi`);
  }

  return { value, certainty: "exact", note: notes.join(" · ") || undefined };
}

/**
 * Oʻlchovi yoʻq kun nol deb sanaladi, lekin bu izohda aytiladi.
 *
 * Nolni jimgina qoʻshish yigʻindini pasaytiradi va sotuvchi buni tushish deb
 * oʻqiydi — shuning uchun tushib qolgan kunlar soni har doim yoziladi.
 */
function ordersOf(day: ShopDay | undefined): number {
  return day?.orders ?? 0;
}

function countMissing(days: ShopDay[], indexes: number[]): number {
  return indexes.filter((i) => days[i] && days[i].orders === null).length;
}

/** Aylanma — TAXMINIY. Dona × narx, shuning uchun hech qachon aniq emas. */
function revenueMetric(days: ShopDay[], indexes: number[]): Metric {
  const value = sum(indexes.map((i) => ordersOf(days[i]) * (days[i]?.avgPrice ?? 0)));
  return { value, certainty: "approx" };
}

function shopDailyOrders(shopId: number, indexes: number[]): SeriesPoint[] {
  const days = db().shopDays.get(shopId) ?? [];
  return indexes.map((i) => ({ date: db().dates[i], value: ordersOf(days[i]) }));
}

// ---------------------------------------------------------------- bosh sahifa

export interface MarketSummary {
  orders: Metric;
  revenue: Metric;
  daily: SeriesPoint[];
}

export function marketSummary(period: Period): MarketSummary {
  const indexes = sliceIndexes(period);
  let orders = 0;
  let revenue = 0;
  const daily = indexes.map((i) => ({ date: db().dates[i], value: 0 }));
  let missing = 0;

  for (const shop of db().shops) {
    const days = db().shopDays.get(shop.id) ?? [];
    indexes.forEach((i, slot) => {
      const day = days[i];
      if (!day) return;
      const value = ordersOf(day);
      if (day.orders === null) missing++;
      orders += value;
      revenue += value * day.avgPrice;
      daily[slot].value += value;
    });
  }

  const lastIndex = indexes[indexes.length - 1];
  const anyShop = db().shopDays.get(db().shops[0]?.id ?? 0) ?? [];
  const notes: string[] = [];
  if (period.id === "today" && anyShop[lastIndex]) {
    notes.push(`${anyShop[lastIndex].sweeps}/${anyShop[lastIndex].sweepsExpected} oʻlchov tushgan`);
  }
  if (missing > 0) {
    notes.push(`${missing} sotuvchi-kun uchun oʻlchov yetmagan`);
  }

  return {
    orders: { value: orders, certainty: "exact", note: notes.join(" · ") || undefined },
    revenue: { value: revenue, certainty: "approx" },
    daily,
  };
}

export interface RankedShop {
  shop: Shop;
  categoryName: string;
  orders: number;
  revenue: number;
}

export function shopsRanked(period: Period): RankedShop[] {
  const indexes = sliceIndexes(period);
  return db().shops
    .map((shop) => {
      const days = db().shopDays.get(shop.id) ?? [];
      return {
        shop,
        categoryName: getCategory(shop.categoryId)?.name ?? "",
        orders: sum(indexes.map((i) => ordersOf(days[i]))),
        revenue: sum(indexes.map((i) => ordersOf(days[i]) * (days[i]?.avgPrice ?? 0))),
      };
    })
    .sort((a, b) => b.orders - a.orders);
}

export interface RankedCategory {
  category: Category;
  orders: number;
  revenue: number;
  shopCount: number;
}

export function categoriesRanked(period: Period): RankedCategory[] {
  const indexes = sliceIndexes(period);
  return db().categories
    .map((category) => {
      const shopIds = db().shopsByCategory.get(category.id) ?? [];
      let orders = 0;
      let revenue = 0;
      for (const id of shopIds) {
        const days = db().shopDays.get(id) ?? [];
        for (const i of indexes) {
          const day = days[i];
          if (!day) continue;
          orders += ordersOf(day);
          revenue += ordersOf(day) * day.avgPrice;
        }
      }
      return { category, orders, revenue, shopCount: shopIds.length };
    })
    .sort((a, b) => b.orders - a.orders);
}

// ---------------------------------------------------------------- oʻrin

/**
 * Oʻrin doim 30 kunlik oynada va doim turkum ichida hisoblanadi.
 *
 * Uch narsa qaytariladi — nima boʻyicha, kimlar orasida, qaysi davrda. Ularsiz
 * "#3" raqami maʻnosiz. Oʻsish/tushish strelkasi yoʻq: ikkinchi oʻlchov
 * yigʻilmagan, shuning uchun oʻrin oʻzgarishini daʻvo qilib boʻlmaydi.
 */
export function shopRank(shopId: number): Rank | null {
  const shop = getShop(shopId);
  if (!shop) return null;
  const period = rankPeriod();
  const indexes = sliceIndexes(period);
  const siblings = db().shopsByCategory.get(shop.categoryId) ?? [];

  const scored = siblings
    .map((id) => {
      const days = db().shopDays.get(id) ?? [];
      return { id, orders: sum(indexes.map((i) => ordersOf(days[i]))) };
    })
    .sort((a, b) => b.orders - a.orders);

  const position = scored.findIndex((s) => s.id === shopId) + 1;
  if (!position) return null;

  return {
    position,
    outOf: scored.length,
    basis: "buyurtma boʻyicha",
    scope: `${getCategory(shop.categoryId)?.name} turkumidagi sotuvchilar`,
    period: "30 kun",
  };
}

export function productRank(productId: number): Rank | null {
  const product = getProduct(productId);
  if (!product) return null;
  const period = rankPeriod();
  const indexes = sliceIndexes(period);
  const siblings = db().productsByCategory.get(product.categoryId) ?? [];

  const scored = siblings
    .map((id) => {
      const days = db().productDays.get(id) ?? [];
      return { id, units: sum(indexes.map((i) => days[i]?.soldUnits ?? 0)) };
    })
    .sort((a, b) => b.units - a.units);

  const position = scored.findIndex((s) => s.id === productId) + 1;
  if (!position) return null;

  return {
    position,
    outOf: scored.length,
    basis: "sotilgan dona boʻyicha (taxminiy)",
    scope: `${getCategory(product.categoryId)?.name} turkumidagi mahsulotlar`,
    period: "30 kun",
  };
}

// ---------------------------------------------------------------- qidiruv

export function search(kind: SearchKind, query: string, limit = 8): SearchHit[] {
  if (query.trim().length < MIN_QUERY_LENGTH) return [];
  const period = rankPeriod();
  const indexes = sliceIndexes(period);

  if (kind === "shop") {
    return db().shops
      .map((shop) => ({ shop, score: matchScore(shop.name, query) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ shop }) => {
        const days = db().shopDays.get(shop.id) ?? [];
        return {
          kind,
          id: shop.id,
          name: shop.name,
          context: getCategory(shop.categoryId)?.name ?? "",
          orders: sum(indexes.map((i) => ordersOf(days[i]))),
          revenue: sum(indexes.map((i) => ordersOf(days[i]) * (days[i]?.avgPrice ?? 0))),
          rank: shopRank(shop.id),
        };
      });
  }

  if (kind === "product") {
    return db().products
      .map((product) => ({ product, score: matchScore(product.name, query) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ product }) => {
        const days = db().productDays.get(product.id) ?? [];
        const units = sum(indexes.map((i) => days[i]?.soldUnits ?? 0));
        const revenue = sum(indexes.map((i) => (days[i]?.soldUnits ?? 0) * (days[i]?.price ?? 0)));
        return {
          kind,
          id: product.id,
          name: product.name,
          context: getShop(product.shopId)?.name ?? "",
          orders: units,
          revenue,
          rank: productRank(product.id),
        };
      });
  }

  return db().categories
    .map((category) => ({ category, score: matchScore(category.name, query) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ category }) => {
      const ranked = categoriesRanked(period).find((c) => c.category.id === category.id);
      return {
        kind,
        id: category.id,
        name: category.name,
        context: `${categoryCounts(category.id).shops} sotuvchi`,
        orders: ranked?.orders ?? 0,
        revenue: ranked?.revenue ?? 0,
        rank: null,
      };
    });
}

// ---------------------------------------------------------------- sotuvchi

export interface ShopProductRow {
  product: Product;
  price: number;
  buyersPerWeek: number;
  units: number;
  stock: number;
  outOfStock: boolean;
}

export interface ShopView {
  shop: Shop;
  categoryName: string;
  productCount: number;
  orders: Metric;
  revenue: Metric;
  rank: Rank | null;
  daily: SeriesPoint[];
  /**
   * Turkumning oʻrtacha sotuvchisi — bir sotuvchi bilan solishtirish uchun
   * turkum yigʻindisi emas, aynan oʻrtachasi olinadi, aks holda ikki chiziq
   * turli kattalikda boʻlib, taqqoslash maʻnosini yoʻqotadi.
   */
  categoryDaily: SeriesPoint[];
  events: ChangeEvent[];
  products: ShopProductRow[];
}

export function shopView(shopId: number, period: Period): ShopView | null {
  const shop = getShop(shopId);
  if (!shop) return null;

  const indexes = sliceIndexes(period);
  const days = db().shopDays.get(shopId) ?? [];
  const siblings = db().shopsByCategory.get(shop.categoryId) ?? [];

  const categoryDaily = indexes.map((i) => {
    let total = 0;
    for (const id of siblings) total += ordersOf(db().shopDays.get(id)?.[i]);
    return { date: db().dates[i], value: siblings.length ? total / siblings.length : 0 };
  });

  const productIds = db().productsByShop.get(shopId) ?? [];
  const lastIndex = indexes[indexes.length - 1] ?? db().dates.length - 1;

  const products: ShopProductRow[] = productIds
    .map((id) => {
      const product = getProduct(id)!;
      const series = db().productDays.get(id) ?? [];
      const last = series[lastIndex];
      return {
        product,
        price: last?.price ?? 0,
        buyersPerWeek: last?.buyersPerWeek ?? 0,
        units: sum(indexes.map((i) => series[i]?.soldUnits ?? 0)),
        stock: last?.stock ?? 0,
        outOfStock: last?.outOfStock ?? false,
      };
    })
    .sort((a, b) => b.units - a.units);

  return {
    shop,
    categoryName: getCategory(shop.categoryId)?.name ?? "",
    productCount: productIds.length,
    orders: ordersMetric(days, indexes, period),
    revenue: revenueMetric(days, indexes),
    rank: shopRank(shopId),
    daily: shopDailyOrders(shopId, indexes),
    categoryDaily,
    events: shopEvents(days).filter((e) => e.date >= period.from && e.date <= period.to),
    products,
  };
}

// ---------------------------------------------------------------- mahsulot

export interface ProductView {
  product: Product;
  shop: Shop;
  categoryName: string;
  discountPercent: number;
  /** MotivationAction.text — ANIQ, doim 7 kunlik. */
  buyersPerWeek: Metric;
  /** Qoldiq kamayishidan — TAXMINIY. */
  units: Metric;
  rank: Rank | null;
  price: number;
  stock: number;
  series: {
    sold: SeriesPoint[];
    price: SeriesPoint[];
    stock: SeriesPoint[];
    reviews: SeriesPoint[];
  };
  /** Tovar boʻlmagan kunlar — grafikda kulrang soya. */
  outOfStockDates: string[];
  events: ChangeEvent[];
}

export function productView(productId: number, period: Period): ProductView | null {
  const product = getProduct(productId);
  if (!product) return null;
  const shop = getShop(product.shopId);
  if (!shop) return null;

  const indexes = sliceIndexes(period);
  const series = db().productDays.get(productId) ?? [];
  const lastIndex = indexes[indexes.length - 1] ?? series.length - 1;
  const last = series[lastIndex];

  const pick = (read: (d: ProductDay) => number): SeriesPoint[] =>
    indexes.map((i) => ({ date: db().dates[i], value: series[i] ? read(series[i]) : 0 }));

  return {
    product,
    shop,
    categoryName: getCategory(product.categoryId)?.name ?? "",
    discountPercent: last?.discountPercent ?? 0,
    // Davr tugmasi buni oʻzgartirmaydi — manba doim 7 kunlik oyna.
    buyersPerWeek: { value: last?.buyersPerWeek ?? 0, certainty: "exact", note: "doim 7 kunlik" },
    units: { value: sum(indexes.map((i) => series[i]?.soldUnits ?? 0)), certainty: "approx" },
    rank: productRank(productId),
    price: last?.price ?? 0,
    stock: last?.stock ?? 0,
    series: {
      sold: pick((d) => d.soldUnits),
      price: pick((d) => d.price),
      stock: pick((d) => d.stock),
      reviews: pick((d) => d.reviews),
    },
    outOfStockDates: indexes.filter((i) => series[i]?.outOfStock).map((i) => db().dates[i]),
    events: productEvents(series).filter((e) => e.date >= period.from && e.date <= period.to),
  };
}

// ---------------------------------------------------------------- turkum

export type EntryDifficulty = "oson" | "oʻrtacha" | "qiyin" | "nomaʻlum";

export interface CategoryView {
  category: Category;
  productCount: number;
  shopCount: number;
  orders: Metric;
  revenue: Metric;
  /** Bitta mahsulotga necha buyurtma toʻgʻri keladi — TAXMINIY emas, boʻlinma. */
  competition: number;
  verdict: {
    difficulty: EntryDifficulty;
    topFiveShare: number | null;
    /** Xulosa chiqarilmagan boʻlsa — nega chiqarilmagani. */
    reason: string;
  };
  shops: RankedShop[];
  products: { product: Product; units: number; price: number; shopName: string }[];
  daily: SeriesPoint[];
}

/**
 * Xulosa uchun eng kam sotuvchi soni.
 *
 * Bundan kam sotuvchi kuzatilgan turkumda top-5 ulushi 100% ga yaqin chiqadi va
 * "kirish qiyin" degan notoʻgʻri xulosaga olib keladi. Shuning uchun bunday
 * holatda xulosa umuman chiqarilmaydi.
 */
const MIN_SHOPS_FOR_VERDICT = 5;

export function categoryView(categoryId: number, period: Period): CategoryView | null {
  const category = getCategory(categoryId);
  if (!category) return null;

  const indexes = sliceIndexes(period);
  const shopIds = db().shopsByCategory.get(categoryId) ?? [];
  const productIds = db().productsByCategory.get(categoryId) ?? [];

  let orders = 0;
  let revenue = 0;
  const daily = indexes.map((i) => ({ date: db().dates[i], value: 0 }));

  const shops: RankedShop[] = shopIds
    .map((id) => {
      const shop = getShop(id)!;
      const days = db().shopDays.get(id) ?? [];
      let shopOrders = 0;
      let shopRevenue = 0;
      indexes.forEach((i, slot) => {
        const day = days[i];
        if (!day) return;
        const value = ordersOf(day);
        shopOrders += value;
        shopRevenue += value * day.avgPrice;
        daily[slot].value += value;
      });
      orders += shopOrders;
      revenue += shopRevenue;
      return { shop, categoryName: category.name, orders: shopOrders, revenue: shopRevenue };
    })
    .sort((a, b) => b.orders - a.orders);

  const lastIndex = indexes[indexes.length - 1] ?? db().dates.length - 1;
  const products = productIds
    .map((id) => {
      const product = getProduct(id)!;
      const series = db().productDays.get(id) ?? [];
      return {
        product,
        units: sum(indexes.map((i) => series[i]?.soldUnits ?? 0)),
        price: series[lastIndex]?.price ?? 0,
        shopName: getShop(product.shopId)?.name ?? "",
      };
    })
    .sort((a, b) => b.units - a.units);

  const topFive = shops.slice(0, 5).reduce((a, s) => a + s.orders, 0);
  const share = orders > 0 ? topFive / orders : null;

  let difficulty: EntryDifficulty = "nomaʻlum";
  let reason =
    `Faqat ${shopIds.length} ta sotuvchi kuzatilgan — xulosa chiqarish uchun kam. ` +
    "Qamrov kengaygach hisoblanadi.";

  if (shopIds.length >= MIN_SHOPS_FOR_VERDICT && share !== null) {
    if (share >= 0.7) {
      difficulty = "qiyin";
      reason = "Buyurtmalarning katta qismi bir necha sotuvchida toʻplangan.";
    } else if (share >= 0.45) {
      difficulty = "oʻrtacha";
      reason = "Yetakchilar bor, lekin bozor ular bilan tugamaydi.";
    } else {
      difficulty = "oson";
      reason = "Buyurtmalar koʻp sotuvchi orasida taqsimlangan.";
    }
  }

  return {
    category,
    productCount: productIds.length,
    shopCount: shopIds.length,
    orders: { value: orders, certainty: "exact" },
    revenue: { value: revenue, certainty: "approx" },
    competition: productIds.length ? orders / productIds.length : 0,
    verdict: { difficulty, topFiveShare: share, reason },
    shops,
    products,
    daily,
  };
}
