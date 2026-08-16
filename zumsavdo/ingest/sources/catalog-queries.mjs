/**
 * Uzum katalogining GraphQL so'rovlari.
 *
 * DIQQAT — bu so'rovlar jonli sxemaga qarshi tekshirilmagan.
 *
 * Katalog uchi (graphql.uzum.uz) ruxsatsiz so'rovni chekkasidayoq rad etadi
 * (`x-ext-authz-check-result: denied`), shuning uchun maydon nomlarini
 * tasdiqlashning imkoni bo'lmadi. Ruxsat olingach `node run-sweep.mjs --probe`
 * ishga tushiriladi: u bitta so'rov yuborib, javobni to'liq bosib chiqaradi va
 * quyidagi nomlarni shunga qarab tuzatish kifoya.
 *
 * Barcha so'rov matni ataylab shu bitta faylda — tuzatish bir joyda bo'ladi.
 */

/** Sotuvchi kartochkasi: ordersQuantity — panelning eng ishonchli raqami. */
export const SHOP_QUERY = `
query zumsavdoShop($shopId: Int!) {
  shop(id: $shopId) {
    id
    title
    official
    ordersQuantity
    reviews
    rating
    category { id title }
  }
}`;

/** Sotuvchining mahsulotlari — sahifalab olinadi. */
export const SHOP_PRODUCTS_QUERY = `
query zumsavdoShopProducts($shopId: Int!, $offset: Int!, $limit: Int!) {
  shopProducts(shopId: $shopId, offset: $offset, limit: $limit) {
    total
    items {
      productId
      title
      category { id title }
    }
  }
}`;

/**
 * Mahsulot kartochkasi.
 *
 * `motivationActions.text` — "Bu haftada N kishi sotib oldi". Bu odam soni,
 * dona ham, buyurtma ham emas; panel uni aynan shunday ko'rsatadi.
 */
export const PRODUCT_QUERY = `
query zumsavdoProduct($productId: Int!) {
  product(id: $productId) {
    id
    title
    rating
    reviewsAmount
    category { id title }
    shop { id title }
    motivationActions { __typename text }
    skuList {
      id
      price
      fullPrice
      availableAmount
      discountBadge { percent }
    }
  }
}`;

/** Turkumdagi sotuvchilarni topish uchun qidiruv. */
export const CATEGORY_QUERY = `
query zumsavdoCategory($categoryId: Int!, $offset: Int!, $limit: Int!) {
  makeSearch(query: {
    categoryId: $categoryId
    pagination: { offset: $offset, limit: $limit }
    filters: []
  }) {
    total
    items {
      catalogCard {
        __typename
        ... on SkuGroupCardWithMeta {
          productId
          title
          ordersAmount
          rating
          minSellPrice
        }
      }
    }
  }
}`;

/**
 * Javobdan kerakli maydonlarni ajratish.
 *
 * So'rov matni o'zgarsa faqat shu funksiyalar tuzatiladi — yig'uvchi ularning
 * natijasidan boshqa hech narsani ko'rmaydi.
 */
export const parse = {
  shop(node) {
    if (!node) return null;
    return {
      id: Number(node.id),
      name: node.title ?? `Sotuvchi ${node.id}`,
      categoryId: node.category?.id != null ? Number(node.category.id) : null,
      official: Boolean(node.official),
      ordersQuantity: toInt(node.ordersQuantity),
      reviews: toInt(node.reviews),
      rating: toNumber(node.rating),
    };
  },

  product(node) {
    if (!node) return null;
    const skus = node.skuList ?? [];
    // Kartochkada bir nechta SKU bo'lishi mumkin: narx eng arzoni bo'yicha,
    // qoldiq esa yig'indi — sotuvchi kartochkani shunday ko'radi.
    const prices = skus.map((s) => toInt(s.price)).filter((n) => n != null);
    const stock = skus.reduce((sum, s) => sum + (toInt(s.availableAmount) ?? 0), 0);
    const discount = skus
      .map((s) => toInt(s.discountBadge?.percent))
      .find((n) => n != null);

    return {
      id: Number(node.id),
      title: node.title ?? `Mahsulot ${node.id}`,
      shopId: node.shop?.id != null ? Number(node.shop.id) : null,
      categoryId: node.category?.id != null ? Number(node.category.id) : null,
      price: prices.length ? Math.min(...prices) : null,
      fullPrice: skus.map((s) => toInt(s.fullPrice)).find((n) => n != null) ?? null,
      discountPercent: discount ?? null,
      stock,
      reviews: toInt(node.reviewsAmount),
      rating: toNumber(node.rating),
      buyersPerWeek: buyersFromMotivation(node.motivationActions),
      available: stock > 0,
    };
  },
};

/**
 * "Bu haftada 772 kishi sotib oldi" → 772.
 *
 * Matn lotin va kirillda, raqam ichida bo'sh joy bo'lishi mumkin. Mos kelmasa
 * null qaytariladi — nol yozish "hech kim olmadi" degan yolg'on javob beradi.
 */
export function buyersFromMotivation(actions) {
  if (!Array.isArray(actions)) return null;
  for (const action of actions) {
    const text = action?.text;
    if (typeof text !== "string") continue;
    const match = text.replace(/ /g, " ").match(/(\d[\d\s]*)\s*(kishi|человек)/i);
    if (match) {
      const n = Number(match[1].replace(/\s/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function toInt(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toNumber(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
