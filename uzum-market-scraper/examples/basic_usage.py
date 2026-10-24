"""Minimal library-usage examples for uzum-market-scraper.

Run with a token in your environment / .env (except the category tree, which
works without one):

    python examples/basic_usage.py
"""

from __future__ import annotations

from uzum_scraper import Config, UzumClient
from uzum_scraper.errors import UzumError


def main() -> None:
    cfg = Config.load()  # reads .env / environment variables

    with UzumClient(cfg) as client:
        # 1) Category tree — no token needed.
        roots = client.get_categories()
        print(f"{len(roots)} root categories, e.g. {[c.title for c in roots[:5]]}")

        # The rest need a valid token; degrade gracefully if it's missing.
        if not cfg.has_token:
            print("\nSet UZUM_AUTH_TOKEN to try product/search/review examples.")
            print("See the README section 'Getting a token'.")
            return

        # 2) Best-selling products in a category.
        print("\nTop 5 best-selling in category 10020:")
        for p in client.iter_category_products(
            10020, sort="BY_ORDERS_QUANTITY_DESC", max_items=5
        ):
            print(f"  {p.orders_quantity:>6} sold  {p.sell_price:>12}  {p.title[:50]}")

        # 3) Search.
        print("\nSearch 'airpods' (first 5):")
        for p in client.iter_search_products("airpods", max_items=5):
            print(f"  {p.rating}★  {p.title[:60]}")

        # 4) One product's details + a few reviews.
        try:
            detail = client.get_product(720033)
            print(f"\nProduct {detail.product_id}: {detail.title}")
            print(f"  sold={detail.orders_amount} rating={detail.rating} reviews={detail.reviews_amount}")
            for r in client.iter_reviews(720033, max_items=3):
                print(f"  {r.rating}★ {r.author}: {r.text[:60]}")
        except UzumError as exc:
            print(f"  (product example skipped: {exc})")


if __name__ == "__main__":
    main()
