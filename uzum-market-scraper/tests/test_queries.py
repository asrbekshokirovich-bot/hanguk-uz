"""Tests for GraphQL query construction."""

from __future__ import annotations

import pytest

from uzum_scraper import queries


def test_variables_category():
    v = queries.build_make_search_variables(category_id=10020, offset=0, limit=48)
    qi = v["queryInput"]
    assert qi["categoryId"] == 10020
    assert qi["pagination"] == {"offset": 0, "limit": 48}
    assert qi["sort"] == queries.SORT_RELEVANCE
    assert qi["text"] == ""
    assert "shopId" not in qi


def test_variables_search_and_shop():
    v = queries.build_make_search_variables(text="iphone", shop_id=730, show_adult=True)
    qi = v["queryInput"]
    assert qi["text"] == "iphone"
    assert qi["shopId"] == 730
    assert qi["showAdultContent"] == "TRUE"


def test_limit_bounds():
    with pytest.raises(ValueError):
        queries.build_make_search_variables(category_id=1, limit=0)
    with pytest.raises(ValueError):
        queries.build_make_search_variables(category_id=1, limit=queries.MAX_LIMIT + 1)
    with pytest.raises(ValueError):
        queries.build_make_search_variables(category_id=1, offset=-1)


def test_full_vs_lite_selection():
    assert "image" in queries.MAKE_SEARCH_FULL
    assert "image" not in queries.MAKE_SEARCH_LITE
    for q in (queries.MAKE_SEARCH_FULL, queries.MAKE_SEARCH_LITE):
        assert "ordersQuantity" in q
        assert "feedbackQuantity" in q


def test_sort_choices_map_to_enums():
    assert queries.SORT_CHOICES["orders"] == queries.SORT_ORDERS
    assert queries.SORT_CHOICES["bestselling"] == queries.SORT_ORDERS
