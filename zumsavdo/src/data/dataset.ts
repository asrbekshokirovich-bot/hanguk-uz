import { DATA_START, fromKey, rangeKeys, today } from "@/lib/dates";
import type {
  Category,
  ChangeEvent,
  Product,
  ProductDay,
  Shop,
  ShopDay,
  SweepStatus,
} from "./types";

/**
 * Namuna maʻlumot toʻplami.
 *
 * Bu qatlam bilan interfeys oʻrtasidagi yagona aloqa `api.ts` — sweep qiluvchi
 * haqiqiy backend ulanganda faqat shu fayl almashtiriladi, sahifalar tegilmaydi.
 *
 * Toʻplam seed boʻyicha aniq takrorlanadi: bir xil id — bir xil qator, shuning
 * uchun sahifa yangilanganda raqamlar sakramaydi.
 */

/** mulberry32 — kichik, tez va takrorlanadigan generator. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)];
}

function between(r: () => number, min: number, max: number): number {
  return min + r() * (max - min);
}

// ---------------------------------------------------------------- nomlar

const CATEGORY_NAMES = [
  "Elektronika",
  "Maishiy texnika",
  "Kiyim-kechak",
  "Poyabzal",
  "Goʻzallik va parvarish",
  "Oziq-ovqat",
  "Bolalar tovarlari",
  "Sport va hordiq",
  "Uy va bogʻ",
  "Avtotovarlar",
] as const;

const SHOP_PREFIX = [
  "Anor", "Baraka", "Chinor", "Doʻstlik", "Elshod", "Farovon", "Gulbahor",
  "Hilol", "Iqbol", "Jasur", "Karvon", "Lochin", "Mehr", "Navroʻz", "Oltin",
  "Poytaxt", "Qadam", "Registon", "Samo", "Turon", "Umid", "Vodiy", "Yulduz",
  "Zafar", "Orzu", "Buloq", "Shodlik", "Nurafshon", "Marvarid", "Sarbon",
] as const;

const SHOP_SUFFIX = [
  "Savdo", "Market", "Store", "Shop", "Trade", "Group", "Plus", "Home",
] as const;

const PRODUCT_TEMPLATES: Record<string, readonly string[]> = {
  Elektronika: [
    "Simsiz quloqchin TWS {m}", "Powerbank {n}000 mAh", "Smart soat {m}",
    "Telefon uchun himoya oynasi {m}", "Bluetooth kolonka {m}",
    "USB-C kabel {n} m", "Simsiz sichqoncha {m}", "Web-kamera {m} HD",
  ],
  "Maishiy texnika": [
    "Blender {n}00 W", "Changyutgich {m}", "Elektr choynak {n},{n} l",
    "Mikroto‘lqinli pech {m}", "Dazmol {n}00 W", "Mikser {m}",
    "Havo namlagich {m}", "Fen {n}00 W",
  ],
  "Kiyim-kechak": [
    "Erkaklar futbolkasi {m}", "Ayollar koʻylagi {m}", "Jinsi shim {m}",
    "Sportcha kostyum {m}", "Kuzgi kurtka {m}", "Trikotaj kofta {m}",
    "Paxta ich kiyim toʻplami", "Sharf {m}",
  ],
  Poyabzal: [
    "Krossovka {m}", "Erkaklar tuflisi {m}", "Ayollar bosonojkasi {m}",
    "Qishki botinka {m}", "Uy shippagi {m}", "Sport kedi {m}",
    "Bolalar sandali {m}", "Rezina etik {m}",
  ],
  "Goʻzallik va parvarish": [
    "Yuz kremi {m} ml", "Shampun {n}00 ml", "Parfyum {m} {n}0 ml",
    "Soch maskasi {m}", "Tish pastasi {m}", "Qoʻl kremi {m}",
    "Kirpik tushi {m}", "Quyoshdan himoya SPF {n}0",
  ],
  "Oziq-ovqat": [
    "Qahva doni {m} {n} kg", "Yashil choy {m}", "Asal {n} kg",
    "Yongʻoq aralashmasi {m}", "Zaytun moyi {n} l", "Shokolad {m}",
    "Quruq mevalar {m}", "Protein bar {m}",
  ],
  "Bolalar tovarlari": [
    "Bolalar konstruktori {m}", "Tagliklar {m} {n}-oʻlcham",
    "Yumshoq oʻyinchoq {m}", "Bolalar velosipedi {m}", "Rivojlantiruvchi kitob {m}",
    "Chaqaloq shishasi {m}", "Bolalar gilami {m}", "Puzzle {n}00 dona",
  ],
  "Sport va hordiq": [
    "Gantel {n} kg", "Yoga gilamchasi {m}", "Rezina ekspander {m}",
    "Sport sumkasi {m}", "Velosiped nasosi {m}", "Turistik chodir {m}",
    "Termos {n},{n} l", "Skakalka {m}",
  ],
  "Uy va bogʻ": [
    "Choyshab toʻplami {m}", "Deraza pardasi {m}", "Oshxona pichogʻi {m}",
    "Gul tuvagi {m}", "Bogʻ shlangi {n}0 m", "Yostiq {m}",
    "Idish quritgich {m}", "Devor soati {m}",
  ],
  Avtotovarlar: [
    "Avto videoregistrator {m}", "Salon gilamchasi {m}", "Avto shampun {n} l",
    "Telefon ushlagichi {m}", "Kompressor {m}", "Bagaj toʻri {m}",
    "Avto muzlatgich {m}", "Shina yamash toʻplami {m}",
  ],
};

const MODEL_CODES = [
  "Pro", "Max", "Lite", "S2", "X1", "A30", "V7", "Neo", "Air", "Ultra",
  "Classic", "Mini", "Plus", "Duo", "Nova",
] as const;

function makeProductName(r: () => number, categoryName: string): string {
  const template = pick(r, PRODUCT_TEMPLATES[categoryName]);
  return template
    .replace(/\{m\}/g, () => pick(r, MODEL_CODES))
    .replace(/\{n\}/g, () => String(1 + Math.floor(r() * 8)));
}

// ---------------------------------------------------------------- tuzilma

export interface Dataset {
  categories: Category[];
  shops: Shop[];
  products: Product[];
  shopDays: Map<number, ShopDay[]>;
  productDays: Map<number, ProductDay[]>;
  productsByShop: Map<number, number[]>;
  productsByCategory: Map<number, number[]>;
  shopsByCategory: Map<number, number[]>;
  dates: string[];
  status: SweepStatus;
  /** Bir kunda kutilayotgan sweeplar soni (har 2 soatda bir marta). */
  sweepsPerDay: number;
}

const SWEEPS_PER_DAY = 12;

function buildDataset(): Dataset {
  const end = today();
  const dates = rangeKeys(DATA_START, end);
  const r = rng(20260728);

  const categories: Category[] = CATEGORY_NAMES.map((name, i) => ({
    id: 1000 + i * 7,
    name,
  }));

  const shops: Shop[] = [];
  const products: Product[] = [];
  const productsByShop = new Map<number, number[]>();
  const productsByCategory = new Map<number, number[]>();
  const shopsByCategory = new Map<number, number[]>();

  let shopSeq = 0;
  let productSeq = 0;

  for (const category of categories) {
    const shopCount = 5 + Math.floor(r() * 4);
    for (let i = 0; i < shopCount; i++) {
      const sr = rng(9100 + shopSeq * 131);
      const id = 9100 + shopSeq * 3 + Math.floor(sr() * 3);
      shopSeq++;
      const name = `${pick(sr, SHOP_PREFIX)} ${pick(sr, SHOP_SUFFIX)}`;
      const shop: Shop = {
        id,
        name,
        categoryId: category.id,
        official: sr() < 0.28,
      };
      shops.push(shop);
      pushTo(shopsByCategory, category.id, id);

      const productCount = 4 + Math.floor(sr() * 7);
      for (let p = 0; p < productCount; p++) {
        const pr = rng(560_000 + productSeq * 97);
        const pid = 560_000 + productSeq * 13 + Math.floor(pr() * 13);
        productSeq++;
        const product: Product = {
          id: pid,
          name: makeProductName(pr, category.name),
          shopId: shop.id,
          categoryId: category.id,
        };
        products.push(product);
        pushTo(productsByShop, shop.id, pid);
        pushTo(productsByCategory, category.id, pid);
      }
    }
  }

  const productDays = new Map<number, ProductDay[]>();
  for (const product of products) {
    productDays.set(product.id, buildProductSeries(product, dates));
  }

  const shopDays = new Map<number, ShopDay[]>();
  for (const shop of shops) {
    const ids = productsByShop.get(shop.id) ?? [];
    shopDays.set(shop.id, buildShopSeries(shop, ids, productDays, dates, end));
  }

  const lastSweep = new Date(fromKey(end));
  const sr = rng(777);
  const sweepsToday = 4 + Math.floor(sr() * (SWEEPS_PER_DAY - 4));
  lastSweep.setHours(sweepsToday * 2, Math.floor(sr() * 59), 0, 0);

  const status: SweepStatus = {
    lastSweepAt: lastSweep.toISOString(),
    coveragePercent: Math.round(between(sr, 91, 99) * 10) / 10,
    errors: Math.floor(sr() * 9),
  };

  return {
    categories,
    shops,
    products,
    shopDays,
    productDays,
    productsByShop,
    productsByCategory,
    shopsByCategory,
    dates,
    status,
    sweepsPerDay: SWEEPS_PER_DAY,
  };
}

function pushTo(map: Map<number, number[]>, key: number, value: number) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Mahsulotning kunlik qatori.
 *
 * Qoldiq talabga qarab kamayadi va vaqti-vaqti bilan toʻldiriladi. Sotuv
 * qoldiq farqidan hisoblanadi — shuning uchun toʻldirish kuni sotuv **yashirin
 * qoladi** va bu taxminiy raqamning asosiy zaifligi. Toʻplam shu zaiflikni
 * ataylab saqlaydi, chunki interfeys uni koʻrsatishi kerak.
 */
function buildProductSeries(product: Product, dates: string[]): ProductDay[] {
  const r = rng(product.id * 31 + 7);
  const basePrice = Math.round(between(r, 35_000, 2_400_000) / 1000) * 1000;
  const popularity = Math.pow(r(), 1.8); // koʻpchilik mahsulot sekin sotiladi
  const baseDemand = 1 + popularity * 42;

  // Narx kunlari: davr davomida 0-3 marta oʻzgaradi.
  const priceChangeDays = new Set<number>();
  const changes = Math.floor(r() * 4);
  for (let i = 0; i < changes; i++) {
    priceChangeDays.add(3 + Math.floor(r() * Math.max(1, dates.length - 4)));
  }

  let price = basePrice;
  let discount = r() < 0.45 ? Math.round(between(r, 5, 40)) : 0;
  let stock = Math.round(between(r, 20, 900));
  let reviews = Math.floor(between(r, 0, 1400));

  const out: ProductDay[] = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const weekday = fromKey(date).getDay();

    if (priceChangeDays.has(i)) {
      const direction = r() < 0.62 ? -1 : 1;
      const step = between(r, 0.05, 0.28) * direction;
      price = Math.round((price * (1 + step)) / 1000) * 1000;
      discount = direction < 0 ? Math.min(70, discount + Math.round(between(r, 5, 20))) : Math.max(0, discount - 5);
    }

    // Dam olish kunlari va arzonlashuvda talab yuqori.
    const weekendLift = weekday === 0 || weekday === 6 ? 1.25 : 1;
    const priceLift = Math.pow(basePrice / price, 1.4);
    const noise = between(r, 0.6, 1.45);
    const wanted = Math.max(0, Math.round(baseDemand * weekendLift * priceLift * noise));

    const openingStock = stock;
    const sold = Math.min(openingStock, wanted);
    let closingStock = openingStock - sold;

    // Tovar tugadi — toʻldirish 0-3 kun ichida keladi.
    let restocked = 0;
    if (closingStock <= 0 && r() < 0.45) {
      restocked = Math.round(between(r, 60, 700));
      closingStock += restocked;
    } else if (closingStock < baseDemand * 2 && r() < 0.2) {
      restocked = Math.round(between(r, 80, 500));
      closingStock += restocked;
    }

    // Qoldiq farqidan koʻrinadigan sotuv — toʻldirish uni yashiradi.
    const observedDrop = Math.max(0, openingStock - closingStock);

    reviews += Math.round(sold * between(r, 0.02, 0.09));
    stock = closingStock;

    out.push({
      productId: product.id,
      date,
      price,
      discountPercent: discount,
      stock: closingStock,
      reviews,
      // MotivationAction.text — oxirgi 7 kundagi **odam** soni, dona emas.
      buyersPerWeek: 0, // pastda toʻldiriladi
      soldUnits: observedDrop,
      outOfStock: openingStock === 0,
    });
  }

  // Haftalik xaridor soni: oxirgi 7 kun sotuvidan, lekin odam soni donadan kam
  // (bitta odam bir nechta dona oladi).
  for (let i = 0; i < out.length; i++) {
    const from = Math.max(0, i - 6);
    let units = 0;
    for (let j = from; j <= i; j++) units += out[j].soldUnits;
    const perBuyer = between(r, 1.05, 1.6);
    out[i].buyersPerWeek = Math.max(0, Math.round(units / perBuyer));
  }

  return out;
}

/**
 * Sotuvchining kunlik qatori.
 *
 * Buyurtmalar `Shop.ordersQuantity` hisoblagichining farqi — bu tizimdagi eng
 * ishonchli raqam, shuning uchun u mahsulot qoldiqlaridan emas, alohida
 * oʻlchovdan keladi va ular bir-biriga toʻliq mos tushmaydi.
 */
function buildShopSeries(
  shop: Shop,
  productIds: number[],
  productDays: Map<number, ProductDay[]>,
  dates: string[],
  endDate: string,
): ShopDay[] {
  const r = rng(shop.id * 17 + 3);
  const scale = between(r, 0.75, 1.35);

  return dates.map((date, i) => {
    let units = 0;
    let priceSum = 0;
    let priceCount = 0;
    for (const pid of productIds) {
      const day = productDays.get(pid)?.[i];
      if (!day) continue;
      units += day.soldUnits;
      priceSum += day.price;
      priceCount++;
    }

    // Bir buyurtmada bir nechta dona boʻlishi mumkin.
    const orders = Math.max(0, Math.round((units / between(r, 1.1, 1.8)) * scale));
    const avgPrice = priceCount ? priceSum / priceCount : 0;

    const isToday = date === endDate;
    const sweeps = isToday
      ? 4 + Math.floor(r() * (SWEEPS_PER_DAY - 4))
      : SWEEPS_PER_DAY - (r() < 0.12 ? 1 : 0);

    // Bugungi kun toʻliq emas — tushgan oʻlchovlar ulushigacha koʻrinadi.
    const partial = isToday ? sweeps / SWEEPS_PER_DAY : 1;

    return {
      shopId: shop.id,
      date,
      orders: Math.round(orders * partial),
      avgPrice,
      sweeps,
      sweepsExpected: SWEEPS_PER_DAY,
    };
  });
}

// ---------------------------------------------------------------- hodisalar

const PRICE_EVENT_THRESHOLD = 0.05;
const REVIEW_JUMP_THRESHOLD = 12;

/** Mahsulot qatoridan "nima oʻzgardi" roʻyxatini yigʻadi. */
export function productEvents(days: ProductDay[]): ChangeEvent[] {
  const events: ChangeEvent[] = [];

  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const day = days[i];

    const priceDelta = (day.price - prev.price) / (prev.price || 1);
    if (Math.abs(priceDelta) >= PRICE_EVENT_THRESHOLD) {
      const down = priceDelta < 0;
      events.push({
        date: day.date,
        kind: down ? "price_down" : "price_up",
        label: down ? "Narx tushdi" : "Narx koʻtarildi",
        amount: `${Math.abs(priceDelta * 100).toFixed(0)}%`,
        followUp: followUpUnits(days, i),
      });
    }

    if (!prev.outOfStock && day.outOfStock) {
      events.push({
        date: day.date,
        kind: "out_of_stock",
        label: "Tovar tugadi",
        amount: "qoldiq 0",
      });
    }

    if (prev.outOfStock && !day.outOfStock) {
      events.push({
        date: day.date,
        kind: "restock",
        label: "Tovar keltirildi",
        amount: `+${day.stock} dona`,
      });
    }

    const reviewDelta = day.reviews - prev.reviews;
    if (reviewDelta >= REVIEW_JUMP_THRESHOLD) {
      events.push({
        date: day.date,
        kind: "reviews_jump",
        label: "Sharhlar koʻpaydi",
        amount: `+${reviewDelta}`,
      });
    }
  }

  return events.reverse();
}

/**
 * Hodisadan keyingi 14 kunda dona qanday oʻzgargani.
 *
 * Bu **kuzatuv**, sabab emas — matnda hech qachon "sababi shu" deb yozilmaydi.
 */
function followUpUnits(days: ProductDay[], at: number): string | undefined {
  const beforeFrom = Math.max(0, at - 14);
  const afterTo = Math.min(days.length - 1, at + 14);
  if (at - beforeFrom < 3 || afterTo - at < 3) return undefined;

  const before = average(days.slice(beforeFrom, at).map((d) => d.soldUnits));
  const after = average(days.slice(at, afterTo + 1).map((d) => d.soldUnits));
  if (before <= 0) return undefined;

  const change = (after - before) / before;
  if (Math.abs(change) < 0.15) return undefined;

  const days_ = afterTo - at;
  const dir = change > 0 ? "oshdi" : "kamaydi";
  return `Keyingi ${days_} kunda dona ${Math.abs(change * 100).toFixed(0)}% ${dir}`;
}

/** Sotuvchi qatoridan sezilarli buyurtma sakrashlarini yigʻadi. */
export function shopEvents(days: ShopDay[]): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  for (let i = 3; i < days.length; i++) {
    const baseline = average(days.slice(Math.max(0, i - 4), i).map((d) => d.orders));
    if (baseline < 4) continue;
    const change = (days[i].orders - baseline) / baseline;
    if (Math.abs(change) < 0.35) continue;
    const up = change > 0;
    events.push({
      date: days[i].date,
      kind: up ? "orders_jump" : "orders_drop",
      label: up ? "Buyurtma koʻpaydi" : "Buyurtma kamaydi",
      amount: `${up ? "+" : "−"}${Math.abs(change * 100).toFixed(0)}%`,
      followUp: `Oldingi 4 kun oʻrtachasi ${baseline.toFixed(0)} ta edi`,
    });
  }
  return events.reverse();
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

let cached: Dataset | null = null;

export function getDataset(): Dataset {
  if (!cached) cached = buildDataset();
  return cached;
}
