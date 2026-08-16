import { AccessDeniedError, SourceError, createLimiter, fetchJson } from "../lib/http.mjs";
import {
  CATEGORY_QUERY,
  PRODUCT_QUERY,
  SHOP_PRODUCTS_QUERY,
  SHOP_QUERY,
  parse,
} from "./catalog-queries.mjs";

/**
 * Uzum katalogidan o'lchov olish.
 *
 * Katalog uchi ruxsatsiz so'rovni rad etadi. Bu manba shu holatni aylanib
 * o'tishga urinmaydi: rad javobi kelsa, sweep darhol to'xtaydi va sababi
 * yoziladi. `UZUM_CATALOG_HEADERS` ga faqat Uzumdan rasmiy olingan ruxsat
 * qo'yiladi.
 */
export function createCatalogSource(config) {
  const limit = createLimiter(config.rateLimit.perSecond);
  const options = {
    limit,
    maxRetries: config.rateLimit.maxRetries,
    timeoutMs: config.rateLimit.timeoutMs,
  };

  async function gql(query, variables) {
    const body = await fetchJson(
      config.catalog.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Language": config.catalog.language,
          ...config.catalog.headers,
        },
        body: JSON.stringify({ query, variables }),
      },
      options,
    );

    if (body.errors?.length) {
      throw new SourceError(
        `Katalog xatosi: ${body.errors.map((e) => e.message).join("; ")}`,
      );
    }
    return body.data ?? {};
  }

  return {
    name: "uzum-catalog",

    describe() {
      const configured = Object.keys(config.catalog.headers).length > 0;
      return (
        `Uzum katalogi (${config.catalog.endpoint})` +
        (configured ? "" : " — kirish sarlavhalari berilmagan")
      );
    },

    /**
     * Bitta so'rov yuborib, ulanish ishlayotganini tekshiradi.
     *
     * Rad javobi kelsa — bu tarmoq nosozligi emas; qayta urinish manbaga
     * ortiqcha yuk beradi, xolos.
     */
    async preflight() {
      const shopId = config.track.shops[0];
      if (!shopId) {
        throw new SourceError(
          "ZUMSAVDO_TRACK_SHOPS bo'sh — qaysi sotuvchilarni kuzatish kerakligi ko'rsatilmagan.",
        );
      }
      const data = await gql(SHOP_QUERY, { shopId });
      return data;
    },

    /** So'rov javobini o'zgartirmasdan qaytaradi — sxemani tekshirish uchun. */
    async probe() {
      const shopId = config.track.shops[0];
      const categoryId = config.track.categories[0];
      const out = {};
      if (shopId) out.shop = await gql(SHOP_QUERY, { shopId });
      if (categoryId) {
        out.category = await gql(CATEGORY_QUERY, {
          categoryId,
          offset: 0,
          limit: 3,
        });
      }
      return out;
    },

    /** Jonli manba bir onda o'lchaydi — o'tmishni qayta o'lchab bo'lmaydi. */
    slots() {
      const at = new Date().toISOString();
      return [{ key: at, observedAt: at }];
    },

    async *collect(slot) {
      const observedAt = slot.observedAt;
      let errors = 0;

      for (const shopId of config.track.shops) {
        try {
          const shopData = await gql(SHOP_QUERY, { shopId });
          const shop = parse.shop(shopData.shop);
          if (!shop) {
            errors++;
            continue;
          }

          const categories = [];
          if (shop.categoryId && shopData.shop?.category?.title) {
            categories.push({ id: shop.categoryId, name: shopData.shop.category.title });
          }

          const products = [];
          const productObservations = [];

          for (const productId of await listProductIds(shopId)) {
            try {
              const productData = await gql(PRODUCT_QUERY, { productId });
              const product = parse.product(productData.product);
              if (!product) {
                errors++;
                continue;
              }
              if (product.categoryId && productData.product?.category?.title) {
                categories.push({
                  id: product.categoryId,
                  name: productData.product.category.title,
                });
              }
              products.push({
                id: product.id,
                title: product.title,
                shopId: product.shopId ?? shop.id,
                categoryId: product.categoryId ?? shop.categoryId,
              });
              productObservations.push({ ...product, productId: product.id, observedAt });
            } catch (error) {
              if (error instanceof AccessDeniedError) throw error;
              errors++;
            }
          }

          yield {
            categories,
            shops: [
              {
                id: shop.id,
                name: shop.name,
                categoryId: shop.categoryId,
                official: shop.official,
              },
            ],
            products,
            shopObservations: [
              {
                shopId: shop.id,
                observedAt,
                ordersQuantity: shop.ordersQuantity,
                reviews: shop.reviews,
                rating: shop.rating,
              },
            ],
            productObservations,
            errors,
          };
          errors = 0;
        } catch (error) {
          if (error instanceof AccessDeniedError) throw error;
          errors++;
          yield emptyBatch(errors);
          errors = 0;
        }
      }
    },
  };

  async function listProductIds(shopId) {
    if (config.track.products.length) return config.track.products;

    const ids = [];
    const limitPerPage = 100;
    for (let offset = 0; offset < 1000; offset += limitPerPage) {
      const data = await gql(SHOP_PRODUCTS_QUERY, {
        shopId,
        offset,
        limit: limitPerPage,
      });
      const items = data.shopProducts?.items ?? [];
      for (const item of items) ids.push(Number(item.productId));
      if (items.length < limitPerPage) break;
    }
    return ids;
  }
}

function emptyBatch(errors) {
  return {
    categories: [],
    shops: [],
    products: [],
    shopObservations: [],
    productObservations: [],
    errors,
  };
}
