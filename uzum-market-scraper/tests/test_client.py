"""End-to-end client tests using httpx.MockTransport (no network)."""

from __future__ import annotations

import json

import httpx
import pytest

from uzum_scraper.client import UzumClient
from uzum_scraper.errors import AuthError, NotFoundError
from uzum_scraper.http_client import HttpClient


def _client(config, handler):
    http = HttpClient(config, transport=httpx.MockTransport(handler))
    return UzumClient(config, http=http)


def _card(pid, orders=0):
    return {
        "id": pid * 10,
        "productId": pid,
        "title": f"Product {pid}",
        "rating": 4.5,
        "ordersQuantity": orders,
        "feedbackQuantity": 1,
        "minSellPrice": 1000,
        "minFullPrice": 1200,
    }


def _gql(cards, total):
    return {"data": {"makeSearch": {"items": [{"catalogCard": c} for c in cards], "total": total}}}


# -- make_search & pagination ----------------------------------------------


def test_make_search_returns_cards_and_total(config):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert "graphql" in str(request.url)
        return httpx.Response(200, json=_gql([_card(1, 100), _card(2, 200)], 2))

    with _client(config, handler) as client:
        cards, total = client.make_search(category_id=10)
    assert total == 2
    assert [c["productId"] for c in cards] == [1, 2]


def test_pagination_and_dedupe(config):
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        offset = body["variables"]["queryInput"]["pagination"]["offset"]
        if offset == 0:
            return httpx.Response(200, json=_gql([_card(1), _card(2)], 3))
        if offset == 2:
            return httpx.Response(200, json=_gql([_card(2), _card(3)], 3))  # 2 is a duplicate
        return httpx.Response(200, json=_gql([], 3))

    with _client(config, handler) as client:
        products = list(client.iter_category_products(10, page_size=2))
    assert [p.product_id for p in products] == [1, 2, 3]  # deduped
    assert products[0].source_type == "category"


def test_max_items_caps_results(config):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_gql([_card(1), _card(2), _card(3)], 100))

    with _client(config, handler) as client:
        products = list(client.iter_category_products(10, page_size=3, max_items=2))
    assert len(products) == 2


# -- GraphQL FULL -> LITE fallback -----------------------------------------


def test_full_query_falls_back_to_lite(config):
    calls = {"full": 0, "lite": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        query = json.loads(request.content)["query"]
        if "image" in query:  # FULL query
            calls["full"] += 1
            return httpx.Response(200, json={"errors": [{"message": "Cannot query field 'image'"}]})
        calls["lite"] += 1
        return httpx.Response(200, json=_gql([_card(1, 5)], 1))

    with _client(config, handler) as client:
        cards, total = client.make_search(category_id=10)
        # second call should go straight to LITE now
        client.make_search(category_id=10)

    assert calls["full"] == 1  # only tried FULL once
    assert calls["lite"] == 2
    assert cards[0]["productId"] == 1


# -- product / reviews / shop / categories ---------------------------------


def test_get_product(config):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/v2/product/123")
        return httpx.Response(200, json={"payload": {"id": 123, "title": "X", "ordersAmount": 42}})

    with _client(config, handler) as client:
        detail = client.get_product(123)
    assert detail.product_id == 123 and detail.orders_amount == 42


def test_iter_reviews_paginates(config):
    def handler(request: httpx.Request) -> httpx.Response:
        # Uzum uses path-based paging: /product/123/reviews/amount/2/page/{p}
        path = request.url.path
        assert "/reviews/amount/2/page/" in path
        page = int(path.rsplit("/page/", 1)[1])
        if page == 0:
            return httpx.Response(
                200, json={"payload": {"reviews": [{"id": 1, "rating": 5}, {"id": 2, "rating": 4}]}}
            )
        if page == 1:
            return httpx.Response(200, json={"payload": {"reviews": [{"id": 3, "rating": 3}]}})
        return httpx.Response(200, json={"payload": {"reviews": []}})

    with _client(config, handler) as client:
        reviews = list(client.iter_reviews(123, page_size=2))
    assert [r.id for r in reviews] == [1, 2, 3]


def test_empty_body_product_raises_auth_error(config):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"")  # token-gated endpoint, insufficient token

    with _client(config, handler) as client:
        with pytest.raises(AuthError):
            client.get_product(123)


def test_get_shop(config):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/shop/bestshop")
        return httpx.Response(
            200,
            json={"payload": {"id": 77, "title": "Best", "ordersAmount": 5000, "link": "bestshop"}},
        )

    with _client(config, handler) as client:
        shop = client.get_shop("bestshop")
    assert shop.id == 77 and shop.orders_amount == 5000


def test_get_categories_tries_endpoints(config):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/main/root-categories"):
            return httpx.Response(
                400, json={"errors": [{"message": "bad"}]}
            )  # not retryable? 400 -> error
        return httpx.Response(200, json={"payload": [{"id": 1, "title": "Root", "children": []}]})

    # 400 raises UzumHTTPError (non-retryable) -> caught, tries next endpoint.
    with _client(config, handler) as client:
        roots = client.get_categories()
    assert len(roots) == 1 and roots[0].title == "Root"


# -- error translation ------------------------------------------------------


def test_auth_error_on_401(config):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401)

    with _client(config, handler) as client:
        with pytest.raises(AuthError):
            client.get_product(1)


def test_redirect_to_captcha_is_auth_error(config):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "https://uzum.uz/showcaptcha"})

    with _client(config, handler) as client:
        with pytest.raises(AuthError):
            client.get_product(1)


def test_not_found(config):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    with _client(config, handler) as client:
        with pytest.raises(NotFoundError):
            client.get_product(1)
