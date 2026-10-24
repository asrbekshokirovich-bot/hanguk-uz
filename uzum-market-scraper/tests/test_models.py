"""Parser tests for the data models."""

from __future__ import annotations

from uzum_scraper.models import (
    CatalogProduct,
    Category,
    ProductDetail,
    Review,
    Shop,
    product_url,
    slugify,
)


def test_catalog_product_from_card():
    card = {
        "id": 555,
        "productId": 123,
        "title": "iPhone 15 Pro",
        "rating": 4.8,
        "ordersQuantity": 1500,
        "feedbackQuantity": 320,
        "minSellPrice": 10990000,
        "minFullPrice": 12990000,
        "favorite": False,
        "adult": False,
        "image": {"high": "high.jpg", "low": "low.jpg"},
    }
    p = CatalogProduct.from_card(card, source_type="category", source_value="10020")
    assert p.product_id == 123
    assert p.sku_id == 555
    assert p.orders_quantity == 1500  # units sold
    assert p.reviews_quantity == 320
    assert p.sell_price == 10990000.0
    assert p.full_price == 12990000.0
    assert p.rating == 4.8
    assert p.image == "high.jpg"
    assert p.source_type == "category" and p.source_value == "10020"
    assert p.url == "https://uzum.uz/uz/product/iphone-15-pro-123"


def test_catalog_product_photos_fallback():
    card = {"productId": 7, "title": "x", "photos": [{"photo": {"high": "p1", "low": "p0"}}]}
    p = CatalogProduct.from_card(card)
    assert p.image == "p1"


def test_catalog_product_to_row_keys():
    row = CatalogProduct.from_card({"productId": 1, "title": "t"}).to_row()
    assert "orders_quantity" in row and "sell_price" in row and "url" in row


def test_product_detail_from_api_envelope():
    payload = {
        "payload": {
            "id": 123,
            "title": "iPhone 15 Pro",
            "description": "Great phone",
            "category": {"id": 10, "title": "Phones"},
            "seller": {"id": 77, "title": "BestShop"},
            "rating": 4.8,
            "reviewsAmount": 320,
            "ordersAmount": 1500,
            "sellPrice": 10990000,
            "fullPrice": 12990000,
            "photos": [{"photo": {"high": "h1"}}, {"photo": {"high": "h2"}}],
            "characteristics": [{"title": "Color", "value": "Black"}],
            "skuList": [{"id": 1}, {"id": 2}],
        }
    }
    d = ProductDetail.from_api(payload)
    assert d.product_id == 123
    assert d.orders_amount == 1500
    assert d.reviews_amount == 320
    assert d.category_title == "Phones" and d.category_id == 10
    assert d.shop_id == 77 and d.shop_title == "BestShop"
    assert d.images == ["h1", "h2"]
    assert d.characteristics["Color"] == "Black"
    assert d.sku_count == 2
    assert d.sell_price == 10990000.0


def test_review_from_api():
    data = {
        "id": 9,
        "rating": 5,
        "content": "Great product",
        "customer": {"name": "Ali"},
        "createdAt": "2026-01-01",
        "likeCount": 3,
        "dislikeCount": 0,
        "reply": {"text": "Thanks!"},
        "photos": [{"photo": {"high": "rp1"}}],
    }
    r = Review.from_api(data, product_id=123)
    assert r.id == 9 and r.product_id == 123
    assert r.rating == 5
    assert r.text == "Great product"
    assert r.author == "Ali"
    assert r.reply == "Thanks!"
    assert r.likes == 3
    assert r.photos == ["rp1"]


def test_shop_from_api():
    payload = {
        "payload": {
            "id": 77,
            "title": "BestShop",
            "link": "bestshop",
            "ordersAmount": 50000,
            "reviews": 1200,
            "rating": 4.9,
            "productAmount": 300,
            "registrationDate": "2020-05-01",
        }
    }
    s = Shop.from_api(payload)
    assert s.id == 77
    assert s.orders_amount == 50000  # store-level units sold
    assert s.reviews_amount == 1200
    assert s.product_amount == 300
    assert s.url == "https://uzum.uz/uz/shop/bestshop"


def test_category_tree_flatten_and_tree():
    data = {
        "id": 1,
        "title": "Root",
        "children": [
            {"id": 2, "title": "Child A", "productAmount": 10},
            {"id": 3, "title": "Child B", "children": [{"id": 4, "title": "Grandchild"}]},
        ],
    }
    root = Category.from_api(data)
    nodes = list(root.flatten())
    assert [n.id for n in nodes] == [1, 2, 3, 4]
    assert nodes[3].parent_id == 3
    assert nodes[3].path == "Root / Child B / Grandchild"
    tree = root.to_tree()
    assert tree["children"][1]["children"][0]["title"] == "Grandchild"


def test_slug_and_url_helpers():
    assert slugify("Hello, World!") == "hello-world"
    assert slugify("") == "product"
    assert product_url(5, "Cool Item") == "https://uzum.uz/uz/product/cool-item-5"
    assert product_url(5) == "https://uzum.uz/uz/product/5"
