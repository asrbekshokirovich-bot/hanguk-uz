/**
 * Namuna manba — quvurni haqiqiy manbasiz uchidan uchigacha tekshirish uchun.
 *
 * Bu manba tayyor kunlik raqamlarni emas, **xom o'lchovlarni** yaratadi:
 * kümülativ `ordersQuantity` hisoblagichi va kun ichida bir necha marta
 * o'lchangan qoldiq. Kunlik raqamni bazadagi rollup hisoblaydi, xuddi haqiqiy
 * manbadagidek. Shu sababli sxema, farq hisobi va "aniq/taxminiy" ajratmasi
 * haqiqiy ulanishdan oldin tekshirilgan bo'ladi.
 */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES = [
  { id: 1000, name: "Elektronika" },
  { id: 1007, name: "Maishiy texnika" },
  { id: 1014, name: "Kiyim-kechak" },
  { id: 1021, name: "Poyabzal" },
];

const SHOP_NAMES = [
  "Anor Savdo", "Baraka Market", "Chinor Store", "Doʻstlik Trade",
  "Elshod Shop", "Farovon Market", "Gulbahor Savdo", "Hilol Plus",
  "Iqbol Home", "Jasur Group", "Karvon Market", "Lochin Store",
];

const PRODUCT_NAMES = [
  "Simsiz quloqchin TWS", "Powerbank 20000 mAh", "Smart soat Pro",
  "Blender 800 W", "Changyutgich Max", "Elektr choynak 1,7 l",
  "Erkaklar futbolkasi", "Ayollar koʻylagi", "Jinsi shim Classic",
  "Krossovka X1", "Qishki botinka Neo", "Uy shippagi Air",
];

/** Sotuvchi va uning mahsulotlarining butun davr davomidagi holati. */
function buildWorld(shopCount, productsPerShop) {
  const shops = [];
  const products = [];

  for (let i = 0; i < shopCount; i++) {
    const r = rng(9100 + i * 131);
    const category = CATEGORIES[i % CATEGORIES.length];
    const shopId = 9100 + i * 3;
    shops.push({
      id: shopId,
      name: SHOP_NAMES[i % SHOP_NAMES.length],
      categoryId: category.id,
      official: r() < 0.3,
      // Kümülativ hisoblagichning boshlang'ich holati.
      ordersQuantity: Math.round(4000 + r() * 60_000),
      reviews: Math.round(200 + r() * 9000),
      rating: Math.round((4 + r()) * 100) / 100,
      dailyOrders: 12 + Math.round(r() * 180),
    });

    for (let p = 0; p < productsPerShop; p++) {
      const pr = rng(560_000 + (i * productsPerShop + p) * 97);
      products.push({
        id: 560_000 + (i * productsPerShop + p) * 13,
        title: `${PRODUCT_NAMES[(i + p) % PRODUCT_NAMES.length]} ${1 + p}`,
        shopId,
        categoryId: category.id,
        price: Math.round((35_000 + pr() * 2_000_000) / 1000) * 1000,
        discountPercent: pr() < 0.45 ? Math.round(5 + pr() * 35) : 0,
        stock: Math.round(60 + pr() * 800),
        reviews: Math.round(pr() * 1200),
        share: 0.4 + pr(),
      });
    }
  }

  return { shops, products };
}

export function createSampleSource(config) {
  const days = Number(process.env.ZUMSAVDO_SAMPLE_DAYS || 21);
  const perDay = Number(process.env.ZUMSAVDO_SAMPLE_SWEEPS_PER_DAY || 12);
  const shopCount = Number(process.env.ZUMSAVDO_SAMPLE_SHOPS || 8);
  const productsPerShop = Number(process.env.ZUMSAVDO_SAMPLE_PRODUCTS_PER_SHOP || 6);

  const world = buildWorld(shopCount, productsPerShop);
  const r = rng(4242);

  // Har bir sotuvchining hisoblagichi va har bir mahsulotning qoldig'i slotdan
  // slotga o'zgarib boradi — xuddi haqiqiy kuzatuvdagidek.
  const state = new Map();
  for (const shop of world.shops) state.set(`s${shop.id}`, shop.ordersQuantity);
  for (const product of world.products) {
    state.set(`p${product.id}`, { stock: product.stock, reviews: product.reviews, price: product.price });
  }

  return {
    name: "sample",

    describe() {
      return `Namuna manba — ${shopCount} sotuvchi, ${shopCount * productsPerShop} mahsulot, ${days} kun × ${perDay} o'lchov`;
    },

    async preflight() {
      return { ok: true };
    },

    /**
     * O'lchov onlari — eng eskisidan boshlab.
     *
     * Tartib muhim: hisoblagichlar ketma-ket o'sadi, shuning uchun slotlar
     * xronologik bo'lishi shart.
     */
    slots() {
      const out = [];
      const now = new Date();
      for (let d = days - 1; d >= 0; d--) {
        for (let s = 0; s < perDay; s++) {
          const at = new Date(now);
          at.setDate(at.getDate() - d);
          at.setHours(Math.floor((24 / perDay) * s), 5, 0, 0);
          if (at > now) continue;
          out.push({ key: at.toISOString(), observedAt: at.toISOString() });
        }
      }
      return out;
    },

    async *collect(slot) {
      const observedAt = slot.observedAt;
      const hour = new Date(observedAt).getHours();
      const weekday = new Date(observedAt).getDay();
      const weekendLift = weekday === 0 || weekday === 6 ? 1.3 : 1;
      // Kechasi savdo sust — slotlar orasidagi o'sish teng emas.
      const dayShare = hour >= 9 && hour <= 22 ? 1.4 : 0.35;

      for (const shop of world.shops) {
        const key = `s${shop.id}`;
        const grew = Math.max(
          0,
          Math.round((shop.dailyOrders / perDay) * weekendLift * dayShare * (0.5 + r())),
        );
        state.set(key, state.get(key) + grew);

        const productObservations = [];
        const products = world.products.filter((p) => p.shopId === shop.id);

        for (const product of products) {
          const s = state.get(`p${product.id}`);
          const sold = Math.min(s.stock, Math.round(grew * product.share * (0.2 + r() * 0.5)));
          s.stock -= sold;
          s.reviews += Math.round(sold * 0.05 * r());

          // Tovar tugasa, keyingi o'lchovlarda to'ldirish kelishi mumkin —
          // aynan shu holat taxminiy sotuvni yashiradi va rollup buni
          // kun ichidagi o'lchovlardan qisman tiklaydi.
          if (s.stock <= 0 && r() < 0.25) s.stock += Math.round(80 + r() * 600);
          if (r() < 0.01) s.price = Math.round((s.price * (0.82 + r() * 0.3)) / 1000) * 1000;

          productObservations.push({
            productId: product.id,
            observedAt,
            price: s.price,
            fullPrice: Math.round(s.price / (1 - product.discountPercent / 100)),
            discountPercent: product.discountPercent,
            stock: s.stock,
            reviews: s.reviews,
            rating: 4.2,
            // Haftalik xaridor — doim 7 kunlik oyna, davrga bog'liq emas.
            buyersPerWeek: Math.max(0, Math.round(product.share * shop.dailyOrders * 7 * 0.35)),
            available: s.stock > 0,
          });
        }

        yield {
          categories: CATEGORIES,
          shops: [
            {
              id: shop.id,
              name: shop.name,
              categoryId: shop.categoryId,
              official: shop.official,
            },
          ],
          products: products.map((p) => ({
            id: p.id,
            title: p.title,
            shopId: p.shopId,
            categoryId: p.categoryId,
          })),
          shopObservations: [
            {
              shopId: shop.id,
              observedAt,
              ordersQuantity: state.get(key),
              reviews: shop.reviews,
              rating: shop.rating,
            },
          ],
          productObservations,
          errors: 0,
        };
      }
    },
  };
}
