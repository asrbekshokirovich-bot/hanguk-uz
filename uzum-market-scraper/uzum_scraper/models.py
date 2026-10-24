"""Typed models for Uzum entities, with tolerant parsers.

The unofficial API changes field names between versions and across the REST vs
GraphQL surfaces, so every parser:
  * tries several candidate keys for each value;
  * coerces numbers defensively;
  * keeps the untouched ``raw`` payload so nothing is ever lost.

Each model also exposes ``to_row()`` producing a flat dict for CSV export.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# small parsing helpers
# ---------------------------------------------------------------------------


def _first(d: dict, *keys: str, default: Any = None) -> Any:
    for k in keys:
        if isinstance(d, dict) and d.get(k) is not None:
            return d[k]
    return default


def _to_int(value: Any, default: int | None = None) -> int | None:
    if value is None or value == "":
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _to_float(value: Any, default: float | None = None) -> float | None:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    slug = _SLUG_RE.sub("-", (text or "").lower()).strip("-")
    return slug or "product"


def product_url(product_id: Any, title: str = "") -> str:
    pid = product_id if product_id is not None else ""
    if title:
        return f"https://uzum.uz/uz/product/{slugify(title)}-{pid}"
    return f"https://uzum.uz/uz/product/{pid}"


def _pick_image(node: dict) -> str:
    """Best-effort single image URL from a catalog card's image/photos block."""
    img = node.get("image")
    if isinstance(img, dict):
        url = _first(img, "high", "low")
        if url:
            return url
    photos = node.get("photos")
    if isinstance(photos, list) and photos:
        photo = photos[0].get("photo") if isinstance(photos[0], dict) else None
        if isinstance(photo, dict):
            return _first(photo, "high", "low", default="") or ""
    return ""


# ---------------------------------------------------------------------------
# models
# ---------------------------------------------------------------------------


@dataclass
class Category:
    id: int | None
    title: str
    parent_id: int | None = None
    product_amount: int | None = None
    adult: bool = False
    children: list[Category] = field(default_factory=list)
    path: str = ""
    raw: dict = field(default_factory=dict)

    @classmethod
    def from_api(cls, data: dict, parent_id: int | None = None, path: str = "") -> Category:
        cid = _to_int(_first(data, "id", "categoryId"))
        title = _first(data, "title", "name", default="") or ""
        node_path = f"{path} / {title}".strip(" /") if path else title
        node = cls(
            id=cid,
            title=title,
            parent_id=parent_id,
            product_amount=_to_int(_first(data, "productAmount", "productsCount", "total")),
            adult=bool(_first(data, "adult", default=False)),
            path=node_path,
            raw=data,
        )
        for child in _first(data, "children", "child", "subcategories", default=[]) or []:
            if isinstance(child, dict):
                node.children.append(cls.from_api(child, parent_id=cid, path=node_path))
        return node

    def flatten(self) -> Iterator[Category]:
        """Yield this node and all descendants depth-first."""
        yield self
        for child in self.children:
            yield from child.flatten()

    def to_row(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "parent_id": self.parent_id,
            "product_amount": self.product_amount,
            "adult": self.adult,
            "path": self.path,
            "child_count": len(self.children),
        }

    def to_tree(self) -> dict:
        """Nested dict for JSON export (this node plus its children)."""
        node = self.to_row()
        node.pop("child_count", None)
        node["children"] = [c.to_tree() for c in self.children]
        return node


@dataclass
class CatalogProduct:
    """A product as it appears in a category/search/shop listing (catalog card)."""

    product_id: int | None
    title: str
    sku_id: int | None = None
    rating: float | None = None
    orders_quantity: int | None = None  # << units sold
    reviews_quantity: int | None = None
    sell_price: float | None = None
    full_price: float | None = None
    favorite: bool = False
    adult: bool = False
    image: str = ""
    url: str = ""
    source_type: str = ""  # "category" | "search" | "shop"
    source_value: str = ""
    raw: dict = field(default_factory=dict)

    @classmethod
    def from_card(
        cls, card: dict, *, source_type: str = "", source_value: str = ""
    ) -> CatalogProduct:
        pid = _to_int(_first(card, "productId", "id"))
        title = _first(card, "title", "name", default="") or ""
        return cls(
            product_id=pid,
            title=title,
            sku_id=_to_int(card.get("id")),
            rating=_to_float(card.get("rating")),
            orders_quantity=_to_int(_first(card, "ordersQuantity", "ordersAmount", "sold")),
            reviews_quantity=_to_int(
                _first(card, "feedbackQuantity", "reviewsQuantity", "reviewsAmount")
            ),
            sell_price=_to_float(_first(card, "minSellPrice", "sellPrice", "purchasePrice")),
            full_price=_to_float(_first(card, "minFullPrice", "fullPrice")),
            favorite=bool(card.get("favorite", False)),
            adult=bool(card.get("adult", False)),
            image=_pick_image(card),
            url=product_url(pid, title),
            source_type=source_type,
            source_value=str(source_value),
            raw=card,
        )

    def to_row(self) -> dict:
        return {
            "product_id": self.product_id,
            "title": self.title,
            "sell_price": self.sell_price,
            "full_price": self.full_price,
            "rating": self.rating,
            "orders_quantity": self.orders_quantity,
            "reviews_quantity": self.reviews_quantity,
            "favorite": self.favorite,
            "adult": self.adult,
            "image": self.image,
            "url": self.url,
            "source_type": self.source_type,
            "source_value": self.source_value,
        }


@dataclass
class ProductDetail:
    """Full product page data from the REST ``/v2/product/{id}`` endpoint."""

    product_id: int | None
    title: str
    description: str = ""
    category_id: int | None = None
    category_title: str = ""
    rating: float | None = None
    reviews_amount: int | None = None
    orders_amount: int | None = None  # << units sold
    sell_price: float | None = None
    full_price: float | None = None
    shop_id: int | None = None
    shop_title: str = ""
    images: list[str] = field(default_factory=list)
    characteristics: dict[str, Any] = field(default_factory=dict)
    sku_count: int | None = None
    url: str = ""
    raw: dict = field(default_factory=dict)

    @classmethod
    def from_api(cls, payload: dict) -> ProductDetail:
        # REST responses wrap the object under "payload" (sometimes "data").
        data = _first(payload, "payload", "data", default=payload) or payload
        if isinstance(data, dict) and "product" in data and isinstance(data["product"], dict):
            data = data["product"]

        pid = _to_int(_first(data, "id", "productId"))
        title = _first(data, "title", "name", default="") or ""
        category = _first(data, "category", default={}) or {}
        seller = _first(data, "seller", "shop", default={}) or {}

        images = _extract_images(data)
        sell, full = _extract_prices(data)

        return cls(
            product_id=pid,
            title=title,
            description=_first(data, "description", "descriptionShort", default="") or "",
            category_id=_to_int(category.get("id")) if isinstance(category, dict) else None,
            category_title=(category.get("title") if isinstance(category, dict) else "") or "",
            rating=_to_float(_first(data, "rating", "reviewsRating")),
            reviews_amount=_to_int(
                _first(data, "reviewsAmount", "reviewsQuantity", "feedbackQuantity")
            ),
            orders_amount=_to_int(_first(data, "ordersAmount", "ordersQuantity", "sold")),
            sell_price=sell,
            full_price=full,
            shop_id=_to_int(seller.get("id")) if isinstance(seller, dict) else None,
            shop_title=(
                seller.get("title") or seller.get("name") if isinstance(seller, dict) else ""
            )
            or "",
            images=images,
            characteristics=_extract_characteristics(data),
            sku_count=_sku_count(data),
            url=product_url(pid, title),
            raw=payload,
        )

    def to_row(self) -> dict:
        return {
            "product_id": self.product_id,
            "title": self.title,
            "category_id": self.category_id,
            "category_title": self.category_title,
            "sell_price": self.sell_price,
            "full_price": self.full_price,
            "rating": self.rating,
            "reviews_amount": self.reviews_amount,
            "orders_amount": self.orders_amount,
            "shop_id": self.shop_id,
            "shop_title": self.shop_title,
            "sku_count": self.sku_count,
            "image_count": len(self.images),
            "first_image": self.images[0] if self.images else "",
            "url": self.url,
        }


@dataclass
class Review:
    id: int | None
    product_id: int | None
    rating: int | None = None
    text: str = ""
    author: str = ""
    created_at: str = ""
    likes: int | None = None
    dislikes: int | None = None
    reply: str = ""
    photos: list[str] = field(default_factory=list)
    raw: dict = field(default_factory=dict)

    @classmethod
    def from_api(cls, data: dict, product_id: int | None = None) -> Review:
        content = _first(data, "content", "text", "comment", default="") or ""
        reply = _first(data, "reply", "answer", default="")
        if isinstance(reply, dict):
            reply = _first(reply, "text", "content", default="") or ""
        author = _first(data, "customer", "author", "user", default="")
        if isinstance(author, dict):
            author = _first(author, "name", "login", "fullName", default="") or ""
        photos = []
        for p in _first(data, "photos", "images", default=[]) or []:
            if isinstance(p, dict):
                url = _first(p, "photo", "image", "url", "high", "low", default="")
                if isinstance(url, dict):
                    url = _first(url, "high", "low", default="")
                if url:
                    photos.append(url)
            elif isinstance(p, str):
                photos.append(p)
        return cls(
            id=_to_int(data.get("id")),
            product_id=product_id if product_id is not None else _to_int(data.get("productId")),
            rating=_to_int(_first(data, "rating", "grade", "stars")),
            text=content,
            author=author or "",
            created_at=str(_first(data, "createdAt", "created", "date", default="") or ""),
            likes=_to_int(_first(data, "likeCount", "likes", "usefulCount")),
            dislikes=_to_int(_first(data, "dislikeCount", "dislikes")),
            reply=reply or "",
            photos=photos,
            raw=data,
        )

    def to_row(self) -> dict:
        return {
            "id": self.id,
            "product_id": self.product_id,
            "rating": self.rating,
            "author": self.author,
            "created_at": self.created_at,
            "likes": self.likes,
            "dislikes": self.dislikes,
            "text": self.text,
            "reply": self.reply,
            "photo_count": len(self.photos),
        }


@dataclass
class Shop:
    id: int | None
    title: str
    slug: str = ""
    orders_amount: int | None = None  # << total units sold by the store
    reviews_amount: int | None = None
    rating: float | None = None
    product_amount: int | None = None
    registration_date: str = ""
    description: str = ""
    avatar: str = ""
    url: str = ""
    raw: dict = field(default_factory=dict)

    @classmethod
    def from_api(cls, payload: dict) -> Shop:
        data = _first(payload, "payload", "data", default=payload) or payload
        if isinstance(data, dict) and "shop" in data and isinstance(data["shop"], dict):
            data = data["shop"]
        sid = _to_int(_first(data, "id", "shopId"))
        slug = _first(data, "link", "slug", "name", default="") or ""
        return cls(
            id=sid,
            title=_first(data, "title", "name", default="") or "",
            slug=slug,
            orders_amount=_to_int(_first(data, "ordersAmount", "ordersQuantity", "orders", "sold")),
            reviews_amount=_to_int(_first(data, "reviews", "reviewsAmount", "reviewsQuantity")),
            rating=_to_float(_first(data, "rating", "reviewsRating")),
            product_amount=_to_int(_first(data, "productAmount", "productsCount", "products")),
            registration_date=str(_first(data, "registrationDate", "createdAt", default="") or ""),
            description=_first(data, "description", "info", default="") or "",
            avatar=_shop_avatar(data),
            url=f"https://uzum.uz/uz/shop/{slug}" if slug else "",
            raw=payload,
        )

    def to_row(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "orders_amount": self.orders_amount,
            "reviews_amount": self.reviews_amount,
            "rating": self.rating,
            "product_amount": self.product_amount,
            "registration_date": self.registration_date,
            "url": self.url,
        }


# ---------------------------------------------------------------------------
# detail-parsing helpers
# ---------------------------------------------------------------------------


def _extract_images(data: dict) -> list[str]:
    images: list[str] = []
    for photo in _first(data, "photos", "images", default=[]) or []:
        if isinstance(photo, str):
            images.append(photo)
        elif isinstance(photo, dict):
            candidate = _first(photo, "photo", "image", "url", "high", "low")
            if isinstance(candidate, dict):
                candidate = _first(candidate, "high", "low", "800", "540", default="")
                if isinstance(candidate, dict):
                    candidate = _first(candidate, "high", "low", default="")
            if candidate:
                images.append(candidate)
    return images


def _extract_prices(data: dict) -> tuple[float | None, float | None]:
    sell = _to_float(_first(data, "sellPrice", "minSellPrice", "purchasePrice", "price"))
    full = _to_float(_first(data, "fullPrice", "minFullPrice"))
    skus = _first(data, "skuList", "skus", default=None)
    if (sell is None or full is None) and isinstance(skus, list) and skus:
        first = skus[0] if isinstance(skus[0], dict) else {}
        sell = sell if sell is not None else _to_float(_first(first, "sellPrice", "purchasePrice"))
        full = full if full is not None else _to_float(_first(first, "fullPrice"))
    return sell, full


def _extract_characteristics(data: dict) -> dict[str, Any]:
    out: dict[str, Any] = {}
    chars = _first(data, "characteristics", "attributes", default=[]) or []
    if isinstance(chars, list):
        for ch in chars:
            if not isinstance(ch, dict):
                continue
            name = _first(ch, "title", "name", default="")
            value = _first(ch, "value", "values", "text", default="")
            if isinstance(value, list):
                value = ", ".join(
                    str(_first(v, "title", "value", default=v) if isinstance(v, dict) else v)
                    for v in value
                )
            if name:
                out[str(name)] = value
    elif isinstance(chars, dict):
        out = chars
    return out


def _sku_count(data: dict) -> int | None:
    skus = _first(data, "skuList", "skus", default=None)
    if isinstance(skus, list):
        return len(skus)
    return _to_int(_first(data, "skuCount", "totalAvailableAmount"))


def _shop_avatar(data: dict) -> str:
    avatar = _first(data, "avatar", "logo", "image", default="")
    if isinstance(avatar, dict):
        return _first(avatar, "high", "low", "url", default="") or ""
    return avatar or ""
