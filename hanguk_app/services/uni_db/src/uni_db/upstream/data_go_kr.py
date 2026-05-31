"""data.go.kr public-data adapter.

The data.go.kr portal exposes thousands of REST/SOAP APIs. Each dataset
authorizes the same `DATA_GO_KR_APP_KEY` but uses dataset-specific URLs.
The most relevant datasets for uni_db are:

* 한국대학교육협의회_대학모집요강 (KCUE recruitment guidelines)
* 한국대학교육협의회_대학정보 (university metadata)
* 대학알리미_등록금 (tuition rates per institution)
* 교육부_고등교육기관 (MoE higher-ed institution registry)

The exact `serviceUrl` for each dataset is dataset-specific and must be
configured via `DataGoKrDataset`. Set `endpoint` to the full URL minus
query params; `params` are merged with `serviceKey=DATA_GO_KR_APP_KEY`.

Common response envelopes:
    {
      "response": {
        "header": {"resultCode": "00", "resultMsg": "NORMAL SERVICE."},
        "body": {
          "totalCount": 330,
          "pageNo": 1,
          "numOfRows": 100,
          "items": {"item": [...]}
        }
      }
    }

OR XML with the same shape. Always check `header.resultCode == "00"`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from ..config import settings

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class DataGoKrDataset:
    """Configuration for one data.go.kr API endpoint.

    Attributes:
        name: Human label for logs (e.g. "kcue_recruitment_guidelines").
        endpoint: Full URL without the query string.
        format_: "json" or "xml" (most datasets serve both).
        default_params: Static params (numOfRows, type=json, etc).
    """

    name: str
    endpoint: str
    format_: str = "json"
    default_params: dict[str, str] = field(default_factory=dict)


async def fetch_page(
    dataset: DataGoKrDataset,
    *,
    http_client: httpx.AsyncClient,
    page: int = 1,
    rows_per_page: int = 100,
    extra_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Fetch one page from a data.go.kr dataset and return the parsed body.

    Raises:
        RuntimeError: if DATA_GO_KR_APP_KEY is not set, or the API
                      reports a non-"00" resultCode.
    """
    if not settings.data_go_kr_app_key:
        raise RuntimeError(
            "DATA_GO_KR_APP_KEY not set. Add it to services/uni_db/.env "
            "after registering the dataset on data.go.kr."
        )

    params = {
        "serviceKey": settings.data_go_kr_app_key,
        "pageNo": str(page),
        "numOfRows": str(rows_per_page),
        "type": dataset.format_,
        **dataset.default_params,
        **(extra_params or {}),
    }
    log.info("data.go.kr fetch dataset=%s page=%d", dataset.name, page)
    resp = await http_client.get(
        dataset.endpoint,
        params=params,
        timeout=settings.http_request_timeout_sec,
    )
    resp.raise_for_status()

    if dataset.format_ == "json":
        payload = resp.json()
    else:
        # Lazy import to keep XML deps optional.
        import xmltodict  # type: ignore[import-not-found]
        payload = xmltodict.parse(resp.text)

    body = (payload.get("response") or {}).get("body") or {}
    header = (payload.get("response") or {}).get("header") or {}

    if header.get("resultCode") not in ("00", None):
        raise RuntimeError(
            f"data.go.kr {dataset.name} returned resultCode="
            f"{header.get('resultCode')}: {header.get('resultMsg')}"
        )

    return body
