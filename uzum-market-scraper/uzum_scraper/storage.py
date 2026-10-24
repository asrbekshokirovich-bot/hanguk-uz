"""Persist scraped records to JSON and CSV, with per-run manifests.

Layout of a run::

    <output_dir>/
      2026-07-27_151230_category-10020/
        products.json        # parsed, human-readable rows
        products.csv         # same rows, flat CSV
        products.raw.json     # untouched API payloads (optional)
        manifest.json         # what ran, when, with what config, how many rows
"""

from __future__ import annotations

import csv
import json
import re
from collections.abc import Iterable, Sequence
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .logging_setup import get_logger

log = get_logger(__name__)

_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def slug_for_path(text: str, maxlen: int = 60) -> str:
    s = _SAFE.sub("-", str(text)).strip("-").lower()
    return (s[:maxlen] or "run").strip("-")


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")


def make_run_dir(output_dir: str | Path, job: str) -> Path:
    run_dir = Path(output_dir) / f"{timestamp()}_{slug_for_path(job)}"
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def _rows(records: Sequence[Any]) -> list[dict]:
    rows = []
    for r in records:
        if hasattr(r, "to_row"):
            rows.append(r.to_row())
        elif isinstance(r, dict):
            rows.append(r)
        elif is_dataclass(r):
            rows.append(asdict(r))
        else:
            rows.append({"value": r})
    return rows


def _csv_cell(value: Any) -> Any:
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bool):
        return "true" if value else "false"
    return "" if value is None else value


def write_json(obj: Any, path: str | Path) -> Path:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2, default=_json_default)
    return p


def write_csv(rows: Sequence[dict], path: str | Path) -> Path:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    # Column order: keys of the first row, then any extra keys seen later.
    fieldnames: list[str] = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)
    with p.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: _csv_cell(row.get(k)) for k in fieldnames})
    return p


def write_dataset(
    records: Sequence[Any],
    run_dir: str | Path,
    name: str,
    *,
    formats: Iterable[str] = ("json", "csv"),
    include_raw: bool = False,
) -> dict[str, str]:
    """Write ``records`` as ``<name>.{json,csv}`` inside ``run_dir``.

    Returns a mapping of format -> written path.
    """
    run_dir = Path(run_dir)
    formats = set(formats)
    rows = _rows(records)
    written: dict[str, str] = {}

    if "json" in formats:
        written["json"] = str(write_json(rows, run_dir / f"{name}.json"))
    if "csv" in formats:
        written["csv"] = str(write_csv(rows, run_dir / f"{name}.csv"))
    if include_raw:
        raw = [getattr(r, "raw", r) for r in records]
        written["raw"] = str(write_json(raw, run_dir / f"{name}.raw.json"))

    log.info("wrote %d %s record(s) -> %s", len(rows), name, run_dir)
    return written


def write_manifest(run_dir: str | Path, meta: dict[str, Any]) -> Path:
    payload = {"generated_at": datetime.now(timezone.utc).isoformat(), **meta}
    return write_json(payload, Path(run_dir) / "manifest.json")


def _json_default(obj: Any) -> Any:
    if is_dataclass(obj):
        return asdict(obj)
    if isinstance(obj, (set, tuple)):
        return list(obj)
    return str(obj)
