/**
 * ZumSavdo maʻlumot modeli.
 *
 * Tizimdagi har bir raqam ikki toifadan biriga tegishli:
 *   - ANIQ      — oʻlchovdan bevosita olingan (Shop.ordersQuantity farqi, MotivationAction.text)
 *   - TAXMINIY  — hisoblab chiqarilgan (aylanma, qoldiq kamayishidan sotuv)
 *
 * Interfeys hech qachon taxminiy raqamni aniq deb koʻrsatmasligi kerak, shuning
 * uchun toifa maʻlumotning oʻzida saqlanadi va `Metric` orqali tashiladi.
 */
export type Certainty = "exact" | "approx";

export interface Metric {
  value: number;
  certainty: Certainty;
  /** Masalan "7/12 oʻlchov" — qisman kun uchun qamrov. */
  note?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Shop {
  id: number;
  name: string;
  categoryId: number;
  /** Uzumdagi rasmiy doʻkon belgisi. */
  official: boolean;
}

export interface Product {
  id: number;
  name: string;
  shopId: number;
  categoryId: number;
}

/** Bitta sotuvchining bitta kundagi oʻlchovi. */
export interface ShopDay {
  shopId: number;
  date: string; // YYYY-MM-DD
  /** Shop.ordersQuantity farqi — ANIQ. */
  orders: number;
  /** Oʻrtacha chek uchun ishlatiladigan narx (soʻm). */
  avgPrice: number;
  /** Shu kuni nechta sweep tushgani va nechtasi kutilgani. */
  sweeps: number;
  sweepsExpected: number;
}

/** Bitta mahsulotning bitta kundagi oʻlchovi. */
export interface ProductDay {
  productId: number;
  date: string; // YYYY-MM-DD
  /** Kartochkadagi narx (soʻm). */
  price: number;
  /** Chegirma foizi. */
  discountPercent: number;
  /** Omborda qolgan dona. */
  stock: number;
  /** Sharhlar soni (jamlanma). */
  reviews: number;
  /** MotivationAction.text dan: "Bu haftada N kishi sotib oldi" — ANIQ, doim 7 kunlik. */
  buyersPerWeek: number;
  /** Qoldiq kamayishidan hisoblangan sotuv — TAXMINIY. */
  soldUnits: number;
  /** Shu kuni tovar boʻlmagan (qoldiq 0). Grafikda kulrang soya. */
  outOfStock: boolean;
}

export type EventKind =
  | "price_down"
  | "price_up"
  | "out_of_stock"
  | "restock"
  | "reviews_jump"
  | "orders_jump"
  | "orders_drop";

/**
 * "Nima oʻzgardi" qatori.
 *
 * Bu roʻyxat sabab-oqibat daʻvo qilmaydi — faqat bir vaqtda nima boʻlganini
 * yozadi. Shuning uchun `text` da "sababi" degan soʻz boʻlmasligi kerak.
 */
export interface ChangeEvent {
  date: string; // YYYY-MM-DD
  kind: EventKind;
  /** Nima oʻzgardi — qisqa nom. */
  label: string;
  /** Qanchaga oʻzgardi — allaqachon formatlangan matn. */
  amount: string;
  /** Hodisadan keyin nima kuzatilgani (ixtiyoriy, sabab emas — kuzatuv). */
  followUp?: string;
}

export interface Rank {
  /** Nechanchi oʻrin. */
  position: number;
  /** Nechta obyekt orasida. */
  outOf: number;
  /** Nima boʻyicha saralangani. */
  basis: string;
  /** Kimlar orasida. */
  scope: string;
  /** Qaysi davr uchun. */
  period: string;
}

export interface SweepStatus {
  /** Oxirgi sweep vaqti (ISO). */
  lastSweepAt: string;
  /** Kuzatilayotgan obyektlarning necha foizi shu sweepda yangilangani. */
  coveragePercent: number;
  /** Oxirgi sweepdagi xatolar soni. */
  errors: number;
}

export type SearchKind = "shop" | "product" | "category";

export interface SearchHit {
  kind: SearchKind;
  id: number;
  name: string;
  /** Turkum yoki sotuvchi nomi — kontekst uchun. */
  context: string;
  orders: number;
  revenue: number;
  rank: Rank | null;
}

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  value: number;
}
