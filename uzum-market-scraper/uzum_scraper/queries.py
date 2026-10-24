"""GraphQL operations and input builders for Uzum's ``makeSearch`` endpoint.

``makeSearch`` is the single operation behind the whole catalog: category
browsing, keyword search and per-shop listings all go through it, differing only
by which fields of the input are populated. It returns catalog cards carrying
the numbers we care about — ``ordersQuantity`` (units sold), ``feedbackQuantity``
(review count), ``rating`` and pricing.

The schema is unofficial and occasionally drifts. To stay resilient we keep two
selections: a FULL one (with images) and a LITE one (scalars only). The client
tries FULL first and falls back to LITE if the server rejects an unknown field.
"""

from __future__ import annotations

from typing import Any

# Sort options accepted by ``MakeSearchQueryInput.sort``.
SORT_RELEVANCE = "BY_RELEVANCE_DESC"
SORT_ORDERS = "BY_ORDERS_QUANTITY_DESC"  # best-selling
SORT_NEWEST = "BY_CREATED_AT_DESC"
SORT_PRICE_ASC = "BY_PRICE_ASC"
SORT_PRICE_DESC = "BY_PRICE_DESC"
SORT_RATING = "BY_RATING_DESC"
SORT_REVIEWS = "BY_REVIEWS_QUANTITY_DESC"

SORT_CHOICES = {
    "relevance": SORT_RELEVANCE,
    "orders": SORT_ORDERS,
    "bestselling": SORT_ORDERS,
    "newest": SORT_NEWEST,
    "price_asc": SORT_PRICE_ASC,
    "price_desc": SORT_PRICE_DESC,
    "rating": SORT_RATING,
    "reviews": SORT_REVIEWS,
}

# Max page size the endpoint reliably serves.
MAX_LIMIT = 100

_CARD_SCALARS = """
      id
      productId
      title
      rating
      ordersQuantity
      feedbackQuantity
      minSellPrice
      minFullPrice
      adult
      favorite
"""

_CARD_IMAGES = """
      image {
        high
        low
      }
      photos {
        photo {
          high
          low
        }
      }
"""

_QUERY_TEMPLATE = """
query getMakeSearch($queryInput: MakeSearchQueryInput!) {{
  makeSearch(query: $queryInput) {{
    id
    queryId
    queryText
    total
    category {{
      id
      title
      parent {{
        id
        title
      }}
    }}
    items {{
      catalogCard {{
{card_fields}
      }}
    }}
  }}
}}
"""

MAKE_SEARCH_FULL = _QUERY_TEMPLATE.format(card_fields=_CARD_SCALARS + _CARD_IMAGES)
MAKE_SEARCH_LITE = _QUERY_TEMPLATE.format(card_fields=_CARD_SCALARS)

OPERATION_NAME = "getMakeSearch"


def build_make_search_variables(
    *,
    category_id: int | str | None = None,
    text: str | None = None,
    shop_id: int | str | None = None,
    offset: int = 0,
    limit: int = 48,
    sort: str = SORT_RELEVANCE,
    filters: list[dict[str, Any]] | None = None,
    show_adult: bool = False,
) -> dict[str, Any]:
    """Assemble the ``$queryInput`` variables for a makeSearch call.

    Populate ``category_id`` to browse a category, ``text`` to search, and/or
    ``shop_id`` to restrict to one seller. They can be combined (e.g. a keyword
    within a category).
    """
    if limit < 1 or limit > MAX_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_LIMIT}, got {limit}")
    if offset < 0:
        raise ValueError("offset must be >= 0")

    query_input: dict[str, Any] = {
        "showAdultContent": "TRUE" if show_adult else "NONE",
        "filters": filters or [],
        "pagination": {"offset": int(offset), "limit": int(limit)},
        "sort": sort,
        "text": text or "",
    }
    if category_id is not None:
        query_input["categoryId"] = int(category_id)
    if shop_id is not None:
        query_input["shopId"] = int(shop_id)

    return {"queryInput": query_input}
