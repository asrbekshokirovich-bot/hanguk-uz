"""High-level, typed client for Uzum Market.

Wraps the transport layer and returns parsed models. Handles pagination,
category-tree fetching and the GraphQL full/lite fallback so callers deal in
:class:`CatalogProduct`, :class:`ProductDetail`, :class:`Review`, etc.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from . import queries
from .config import Config
from .errors import AuthError, GraphQLError, NotFoundError, UzumError
from .http_client import HttpClient
from .logging_setup import get_logger
from .models import CatalogProduct, Category, ProductDetail, Review, Shop

log = get_logger(__name__)

# Endpoints tried in order when fetching the category tree (schema has moved).
_CATEGORY_ENDPOINTS = ("main/root-categories", "main/categories", "categories")


class UzumClient:
    """Typed access to Uzum's catalog. Use as a context manager."""

    def __init__(self, config: Config, *, http: HttpClient | None = None):
        self.config = config
        self._http = http or HttpClient(config)
        self._use_lite_search = False  # flipped on first FULL-query rejection

    # -- lifecycle ----------------------------------------------------------
    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> UzumClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- categories ---------------------------------------------------------
    def get_categories(self) -> list[Category]:
        """Return the category tree as root :class:`Category` nodes.

        Works without a real token — the category tree is public.
        """
        last_err: Exception | None = None
        for endpoint in _CATEGORY_ENDPOINTS:
            try:
                payload = self._http.get_json(endpoint)
            except (NotFoundError, GraphQLError) as exc:
                last_err = exc
                continue
            except UzumError as exc:
                last_err = exc
                continue
            roots = _extract_category_list(payload)
            if roots:
                return [Category.from_api(node) for node in roots]
        if last_err:
            raise last_err
        return []

    def iter_categories(self) -> Iterator[Category]:
        """Yield every category (roots and descendants), depth-first."""
        for root in self.get_categories():
            yield from root.flatten()

    # -- catalog (category / search / shop) ---------------------------------
    def make_search(
        self,
        *,
        category_id: int | str | None = None,
        text: str | None = None,
        shop_id: int | str | None = None,
        offset: int = 0,
        limit: int = 48,
        sort: str = queries.SORT_RELEVANCE,
        show_adult: bool = False,
    ) -> tuple[list[dict], int]:
        """Run one makeSearch page. Returns (catalog cards, total count)."""
        self.config.require_token()
        variables = queries.build_make_search_variables(
            category_id=category_id,
            text=text,
            shop_id=shop_id,
            offset=offset,
            limit=limit,
            sort=sort,
            show_adult=show_adult,
        )
        data = self._make_search_call(variables)
        node = data.get("makeSearch") or {}
        items = node.get("items") or []
        cards = [
            it.get("catalogCard") for it in items if isinstance(it, dict) and it.get("catalogCard")
        ]
        total = int(node.get("total") or 0)
        return cards, total

    def _make_search_call(self, variables: dict[str, Any]) -> dict[str, Any]:
        query = queries.MAKE_SEARCH_LITE if self._use_lite_search else queries.MAKE_SEARCH_FULL
        try:
            return self._http.graphql(queries.OPERATION_NAME, query, variables)
        except GraphQLError:
            if self._use_lite_search:
                raise
            log.warning("makeSearch FULL query rejected; falling back to LITE (no images).")
            self._use_lite_search = True
            return self._http.graphql(queries.OPERATION_NAME, queries.MAKE_SEARCH_LITE, variables)

    def _iter_catalog(
        self,
        *,
        source_type: str,
        source_value: str,
        category_id: int | str | None = None,
        text: str | None = None,
        shop_id: int | str | None = None,
        sort: str = queries.SORT_RELEVANCE,
        page_size: int = 48,
        max_items: int | None = None,
        show_adult: bool = False,
    ) -> Iterator[CatalogProduct]:
        offset = 0
        yielded = 0
        seen: set[int] = set()
        while True:
            cards, total = self.make_search(
                category_id=category_id,
                text=text,
                shop_id=shop_id,
                offset=offset,
                limit=page_size,
                sort=sort,
                show_adult=show_adult,
            )
            if not cards:
                break
            for card in cards:
                product = CatalogProduct.from_card(
                    card, source_type=source_type, source_value=source_value
                )
                # De-dupe by productId — paginated listings sometimes overlap.
                if product.product_id is not None:
                    if product.product_id in seen:
                        continue
                    seen.add(product.product_id)
                yield product
                yielded += 1
                if max_items is not None and yielded >= max_items:
                    return
            offset += page_size
            if total and offset >= total:
                break

    def iter_category_products(
        self,
        category_id: int | str,
        *,
        sort: str = queries.SORT_RELEVANCE,
        page_size: int = 48,
        max_items: int | None = None,
        show_adult: bool = False,
    ) -> Iterator[CatalogProduct]:
        yield from self._iter_catalog(
            source_type="category",
            source_value=str(category_id),
            category_id=category_id,
            sort=sort,
            page_size=page_size,
            max_items=max_items,
            show_adult=show_adult,
        )

    def iter_search_products(
        self,
        text: str,
        *,
        category_id: int | str | None = None,
        sort: str = queries.SORT_RELEVANCE,
        page_size: int = 48,
        max_items: int | None = None,
        show_adult: bool = False,
    ) -> Iterator[CatalogProduct]:
        yield from self._iter_catalog(
            source_type="search",
            source_value=text,
            text=text,
            category_id=category_id,
            sort=sort,
            page_size=page_size,
            max_items=max_items,
            show_adult=show_adult,
        )

    def iter_shop_products(
        self,
        shop_id: int | str,
        *,
        sort: str = queries.SORT_RELEVANCE,
        page_size: int = 48,
        max_items: int | None = None,
    ) -> Iterator[CatalogProduct]:
        yield from self._iter_catalog(
            source_type="shop",
            source_value=str(shop_id),
            shop_id=shop_id,
            sort=sort,
            page_size=page_size,
            max_items=max_items,
        )

    # -- product detail -----------------------------------------------------
    def get_product(self, product_id: int | str) -> ProductDetail:
        """Full product details. Requires a valid token."""
        payload = self._http.get_json(f"v2/product/{product_id}")
        if payload is None:
            raise AuthError(
                200,
                f"empty response for product {product_id} — full product details need a valid "
                "token. Import one with `uzum-scraper auth --from-curl-file curl.txt`.",
            )
        return ProductDetail.from_api(payload if isinstance(payload, dict) else {})

    def get_similar(self, product_id: int | str) -> list[CatalogProduct]:
        payload = self._http.get_json(f"v2/product/{product_id}/similar")
        items = _extract_list(payload, "payload", "data", "items")
        return [
            CatalogProduct.from_card(c, source_type="similar", source_value=str(product_id))
            for c in items
            if isinstance(c, dict)
        ]

    # -- reviews ------------------------------------------------------------
    def iter_reviews(
        self,
        product_id: int | str,
        *,
        page_size: int = 30,
        max_items: int | None = None,
    ) -> Iterator[Review]:
        """Yield a product's reviews. Uzum uses path-based paging:
        ``/product/{id}/reviews/amount/{n}/page/{p}``. Requires a valid token.
        """
        pid = int(product_id) if str(product_id).isdigit() else None
        page = 0
        yielded = 0
        while True:
            payload = self._http.get_json(
                f"product/{product_id}/reviews/amount/{page_size}/page/{page}"
            )
            if payload is None:
                # Empty body: with no real token this endpoint returns 200-empty.
                if page == 0 and not self._http.has_real_token:
                    raise AuthError(
                        200,
                        "empty response — reviews need a valid token. Import one with "
                        "`uzum-scraper auth --from-curl-file curl.txt`.",
                    )
                break
            reviews = _extract_review_list(payload)
            if not reviews:
                break
            for item in reviews:
                if not isinstance(item, dict):
                    continue
                yield Review.from_api(item, product_id=pid)
                yielded += 1
                if max_items is not None and yielded >= max_items:
                    return
            if len(reviews) < page_size:
                break
            page += 1

    # -- shop ---------------------------------------------------------------
    def get_shop(self, shop_name: str) -> Shop:
        """Shop profile incl. total sale count. Requires a valid token."""
        payload = self._http.get_json(f"shop/{shop_name}")
        if payload is None:
            raise AuthError(
                200,
                f"empty response for shop {shop_name!r} — shop data needs a valid token.",
            )
        return Shop.from_api(payload if isinstance(payload, dict) else {})


# ---------------------------------------------------------------------------
# envelope helpers
# ---------------------------------------------------------------------------


def _extract_category_list(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in ("payload", "data"):
            inner = payload.get(key)
            if isinstance(inner, list):
                return [x for x in inner if isinstance(x, dict)]
            if isinstance(inner, dict):
                for sub in ("categories", "children", "items", "roots"):
                    lst = inner.get(sub)
                    if isinstance(lst, list):
                        return [x for x in lst if isinstance(x, dict)]
        for sub in ("categories", "children", "items"):
            lst = payload.get(sub)
            if isinstance(lst, list):
                return [x for x in lst if isinstance(x, dict)]
    return []


def _extract_list(payload: Any, *keys: str) -> list:
    cur: Any = payload
    for key in keys:
        if isinstance(cur, dict) and key in cur:
            cur = cur[key]
        else:
            cur = None
            break
    if isinstance(cur, list):
        return cur
    if isinstance(payload, dict):
        inner = payload.get("payload", payload)
        if isinstance(inner, list):
            return inner
        if isinstance(inner, dict):
            for k in ("items", "list", "content"):
                if isinstance(inner.get(k), list):
                    return inner[k]
    return []


def _extract_review_list(payload: Any) -> list:
    if isinstance(payload, dict):
        inner = payload.get("payload", payload)
        if isinstance(inner, list):
            return inner
        if isinstance(inner, dict):
            for k in ("reviews", "items", "content", "list", "data"):
                if isinstance(inner.get(k), list):
                    return inner[k]
    if isinstance(payload, list):
        return payload
    return []
