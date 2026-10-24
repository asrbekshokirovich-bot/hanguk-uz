"""Tests for JSON/CSV writers."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from uzum_scraper import storage
from uzum_scraper.models import CatalogProduct


def _products():
    return [
        CatalogProduct.from_card({"productId": 1, "title": "A", "ordersQuantity": 10}),
        CatalogProduct.from_card({"productId": 2, "title": "B", "ordersQuantity": 20}),
    ]


def test_write_dataset_json_and_csv(tmp_path):
    run_dir = storage.make_run_dir(tmp_path, "category-1")
    out = storage.write_dataset(_products(), run_dir, "products", formats=("json", "csv"))

    data = json.loads(Path(out["json"]).read_text(encoding="utf-8"))
    assert [row["product_id"] for row in data] == [1, 2]
    assert data[0]["orders_quantity"] == 10

    with Path(out["csv"]).open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert rows[1]["title"] == "B"
    assert "orders_quantity" in rows[0]


def test_write_dataset_include_raw(tmp_path):
    run_dir = storage.make_run_dir(tmp_path, "job")
    out = storage.write_dataset(
        _products(), run_dir, "products", formats=("json",), include_raw=True
    )
    raw = json.loads(Path(out["raw"]).read_text(encoding="utf-8"))
    assert raw[0]["productId"] == 1  # untouched payload


def test_csv_serializes_complex_cells(tmp_path):
    rows = [{"a": [1, 2], "b": {"x": 1}, "c": True, "d": None}]
    path = storage.write_csv(rows, tmp_path / "t.csv")
    text = Path(path).read_text(encoding="utf-8")
    assert "[1, 2]" in text
    assert "true" in text


def test_manifest_written(tmp_path):
    run_dir = storage.make_run_dir(tmp_path, "job")
    p = storage.write_manifest(run_dir, {"job": "job", "counts": {"products": 2}})
    meta = json.loads(Path(p).read_text(encoding="utf-8"))
    assert meta["counts"]["products"] == 2
    assert "generated_at" in meta


def test_slug_for_path():
    assert storage.slug_for_path("iPhone 15 / Pro!") == "iphone-15-pro"
