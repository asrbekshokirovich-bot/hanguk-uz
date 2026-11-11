"""Orchestrated scrape jobs: fetch, enrich, and write output in one call.

Each ``scrape_*`` function drives :class:`UzumClient`, streams results, and
persists JSON/CSV under a timestamped run directory, returning a summary.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, TypeVar

from . import queries, storage
from .client import UzumClient
from .config import Config
from .errors import NotFoundError, UzumError
from .logging_setup import get_logger
from .models import CatalogProduct

log = get_logger(__name__)

T = TypeVar("T")


@dataclass
class ScrapeResult:
    job: str
    run_dir: str
    counts: dict[str, int] = field(default_factory=dict)
    outputs: dict[str, dict[str, str]] = field(default_factory=dict)

    def summary(self) -> str:
        parts = ", ".join(f"{v} {k}" for k, v in self.counts.items())
        return f"{self.job}: {parts or 'no records'} -> {self.run_dir}"


def _progress(iterable: Iterable[T], label: str, every: int = 50) -> Iterator[T]:
    """Yield items while logging a running count — TTY-agnostic, no deps needed."""
    count = 0
    for item in iterable:
        count += 1
        if count % every == 0:
            log.info("  %s: %d so far…", label, count)
        yield item
    if count == 0 or count % every != 0:
        log.info("  %s: %d total", label, count)


def _collect(products: Iterator[CatalogProduct], label: str) -> list[CatalogProduct]:
    return list(_progress(products, label))


# ---------------------------------------------------------------------------
# jobs
# ---------------------------------------------------------------------------


def scrape_categories(
    client: UzumClient, cfg: Config, *, formats: Iterable[str] = ("json", "csv")
) -> ScrapeResult:
    """Fetch the full category tree; write nested JSON + flat CSV."""
    log.info("Fetching category tree…")
    roots = client.get_categories()
    flat = [node for root in roots for node in root.flatten()]

    run_dir = storage.make_run_dir(cfg.output_dir, "categories")
    outputs: dict[str, dict[str, str]] = {}
    if "json" in set(formats):
        outputs["tree"] = {
            "json": str(
                storage.write_json(
                    [r.to_tree() for r in roots], Path(run_dir) / "categories.tree.json"
                )
            )
        }
    outputs["flat"] = storage.write_dataset(flat, run_dir, "categories", formats=formats)

    result = ScrapeResult(
        job="categories",
        run_dir=str(run_dir),
        counts={"categories": len(flat), "roots": len(roots)},
        outputs=outputs,
    )
    storage.write_manifest(run_dir, _manifest(cfg, "categories", result.counts))
    return result


def scrape_category(
    client: UzumClient,
    cfg: Config,
    category_id: int | str,
    *,
    sort: str = queries.SORT_RELEVANCE,
    max_products: int | None = None,
    with_details: bool = False,
    with_reviews: bool = False,
    max_reviews: int | None = 200,
    formats: Iterable[str] = ("json", "csv"),
    show_adult: bool = False,
) -> ScrapeResult:
    """Scrape products in a category (with sale counts, ratings, prices)."""
    cfg.require_token()  # catalog listings use GraphQL, which needs a real token
    log.info("Scraping category %s (sort=%s)…", category_id, sort)
    products = _collect(
        client.iter_category_products(
            category_id, sort=sort, max_items=max_products, show_adult=show_adult
        ),
        f"category {category_id} products",
    )
    return _finish_catalog_job(
        client,
        cfg,
        f"category-{category_id}",
        products,
        with_details=with_details,
        with_reviews=with_reviews,
        max_reviews=max_reviews,
        formats=formats,
    )


def scrape_search(
    client: UzumClient,
    cfg: Config,
    text: str,
    *,
    category_id: int | str | None = None,
    sort: str = queries.SORT_RELEVANCE,
    max_products: int | None = None,
    with_details: bool = False,
    with_reviews: bool = False,
    max_reviews: int | None = 200,
    formats: Iterable[str] = ("json", "csv"),
    show_adult: bool = False,
) -> ScrapeResult:
    """Scrape products matching a search query."""
    cfg.require_token()  # search uses GraphQL, which needs a real token
    log.info("Searching %r (sort=%s)…", text, sort)
    products = _collect(
        client.iter_search_products(
            text,
            category_id=category_id,
            sort=sort,
            max_items=max_products,
            show_adult=show_adult,
        ),
        f"search {text!r} products",
    )
    return _finish_catalog_job(
        client,
        cfg,
        f"search-{text}",
        products,
        with_details=with_details,
        with_reviews=with_reviews,
        max_reviews=max_reviews,
        formats=formats,
    )


def scrape_shop(
    client: UzumClient,
    cfg: Config,
    shop_name: str,
    *,
    shop_id: int | str | None = None,
    sort: str = queries.SORT_RELEVANCE,
    max_products: int | None = None,
    with_details: bool = False,
    with_reviews: bool = False,
    max_reviews: int | None = 200,
    formats: Iterable[str] = ("json", "csv"),
) -> ScrapeResult:
    """Scrape a shop's profile (incl. total sale count) and its catalog."""
    cfg.require_token()  # shop profile + listings need a real token
    run_dir = storage.make_run_dir(cfg.output_dir, f"shop-{shop_name}")
    counts: dict[str, int] = {}
    outputs: dict[str, dict[str, str]] = {}

    log.info("Fetching shop %r…", shop_name)
    shop = client.get_shop(shop_name)
    outputs["shop"] = storage.write_dataset(
        [shop], run_dir, "shop", formats=formats, include_raw=True
    )
    counts["shop"] = 1
    if shop.id is None and shop_id is None:
        log.warning("Could not resolve a numeric shop id; product listing may be empty.")

    resolved_id = shop_id if shop_id is not None else shop.id
    products: list[CatalogProduct] = []
    if resolved_id is not None:
        products = _collect(
            client.iter_shop_products(resolved_id, sort=sort, max_items=max_products),
            f"shop {shop_name} products",
        )
        outputs["products"] = storage.write_dataset(products, run_dir, "products", formats=formats)
        counts["products"] = len(products)
        # Per-store sale count also computable as sum of product orders.
        counts["orders_sum_from_products"] = sum(p.orders_quantity or 0 for p in products)

    if with_details or with_reviews:
        _enrich(
            client,
            cfg,
            run_dir,
            products,
            with_details,
            with_reviews,
            max_reviews,
            counts,
            outputs,
            formats,
        )

    storage.write_manifest(run_dir, _manifest(cfg, f"shop-{shop_name}", counts))
    return ScrapeResult(
        job=f"shop-{shop_name}", run_dir=str(run_dir), counts=counts, outputs=outputs
    )


def scrape_product(
    client: UzumClient,
    cfg: Config,
    product_id: int | str,
    *,
    with_reviews: bool = True,
    max_reviews: int | None = 500,
    formats: Iterable[str] = ("json", "csv"),
) -> ScrapeResult:
    """Scrape a single product's full details and (optionally) its reviews."""
    cfg.require_token()  # product details + reviews need a real token
    run_dir = storage.make_run_dir(cfg.output_dir, f"product-{product_id}")
    counts: dict[str, int] = {}
    outputs: dict[str, dict[str, str]] = {}

    log.info("Fetching product %s…", product_id)
    detail = client.get_product(product_id)
    outputs["product"] = storage.write_dataset(
        [detail], run_dir, "product", formats=formats, include_raw=True
    )
    counts["product"] = 1

    if with_reviews:
        reviews = _collect_reviews(client, product_id, max_reviews)
        outputs["reviews"] = storage.write_dataset(reviews, run_dir, "reviews", formats=formats)
        counts["reviews"] = len(reviews)

    storage.write_manifest(run_dir, _manifest(cfg, f"product-{product_id}", counts))
    return ScrapeResult(
        job=f"product-{product_id}", run_dir=str(run_dir), counts=counts, outputs=outputs
    )


# ---------------------------------------------------------------------------
# shared internals
# ---------------------------------------------------------------------------


def _finish_catalog_job(
    client: UzumClient,
    cfg: Config,
    job: str,
    products: list[CatalogProduct],
    *,
    with_details: bool,
    with_reviews: bool,
    max_reviews: int | None,
    formats: Iterable[str],
) -> ScrapeResult:
    run_dir = storage.make_run_dir(cfg.output_dir, job)
    counts = {"products": len(products)}
    outputs = {"products": storage.write_dataset(products, run_dir, "products", formats=formats)}

    if with_details or with_reviews:
        _enrich(
            client,
            cfg,
            run_dir,
            products,
            with_details,
            with_reviews,
            max_reviews,
            counts,
            outputs,
            formats,
        )

    storage.write_manifest(run_dir, _manifest(cfg, job, counts))
    return ScrapeResult(job=job, run_dir=str(run_dir), counts=counts, outputs=outputs)


def _enrich(
    client: UzumClient,
    cfg: Config,
    run_dir: Path,
    products: list[CatalogProduct],
    with_details: bool,
    with_reviews: bool,
    max_reviews: int | None,
    counts: dict[str, int],
    outputs: dict[str, dict[str, str]],
    formats: Iterable[str],
) -> None:
    ids = [p.product_id for p in products if p.product_id is not None]

    if with_details:
        details = []
        for pid in _progress(ids, "product details"):
            try:
                details.append(client.get_product(pid))
            except NotFoundError:
                continue
            except UzumError as exc:
                log.warning("detail fetch failed for %s: %s", pid, exc)
        outputs["details"] = storage.write_dataset(
            details, run_dir, "product_details", formats=formats, include_raw=True
        )
        counts["details"] = len(details)

    if with_reviews:
        all_reviews = []
        for pid in _progress(ids, "reviews"):
            all_reviews.extend(_collect_reviews(client, pid, max_reviews))
        outputs["reviews"] = storage.write_dataset(all_reviews, run_dir, "reviews", formats=formats)
        counts["reviews"] = len(all_reviews)


def _collect_reviews(client: UzumClient, product_id: int | str, max_reviews: int | None) -> list:
    try:
        return list(client.iter_reviews(product_id, max_items=max_reviews))
    except NotFoundError:
        return []
    except UzumError as exc:
        log.warning("review fetch failed for %s: %s", product_id, exc)
        return []


def _manifest(cfg: Config, job: str, counts: dict[str, Any]) -> dict[str, Any]:
    return {
        "job": job,
        "counts": counts,
        "config": cfg.redacted(),
        "tool": "uzum-market-scraper",
    }
