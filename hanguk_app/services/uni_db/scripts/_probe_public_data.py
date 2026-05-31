"""Probe data.go.kr + Adiga keys against candidate endpoints.

The .env carries DATA_GO_KR_APP_KEY + ADIGA_APP_KEY but the codebase
doesn't yet know which datasets they're authorized for. This script
tries a small catalog of candidate endpoints and reports which ones
respond cleanly. The successful endpoints can then be turned into
proper DataGoKrDataset configs.
"""

import asyncio
import logging

import httpx

from uni_db.config import settings


logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("probe")

# Candidate data.go.kr endpoints. The path part of the URL is what
# matters — the dataset is identified by the service key + endpoint pair.
CANDIDATES = [
    # KCUE — 한국대학교육협의회_대학 모집요강 정보 service
    (
        "kcue_recruitment_summary",
        "https://apis.data.go.kr/B552077/SoojiOpenAPI/getSoojiList",
    ),
    # 한국교육개발원_학과정보 (KEDI dept registry)
    (
        "kedi_dept_info",
        "https://apis.data.go.kr/B552081/openApiDeptInfo/getDeptInfo",
    ),
    # 대학정보공시 / 대학알리미 등록금
    (
        "academy_info_tuition",
        "https://api.academyinfo.go.kr/openapi/service/rest/AcademyInfoSvc/getU_K70010A_2",
    ),
]


async def main() -> None:
    if not settings.data_go_kr_app_key:
        log.error("DATA_GO_KR_APP_KEY missing in env — cannot probe.")
        return

    log.info("probe with DATA_GO_KR_APP_KEY len=%d", len(settings.data_go_kr_app_key))
    log.info("probe with ADIGA_APP_KEY len=%d", len(settings.adiga_app_key or ""))

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as http:
        for name, url in CANDIDATES:
            log.info("\n=== %s ===\n%s", name, url)
            try:
                resp = await http.get(
                    url,
                    params={
                        "serviceKey": settings.data_go_kr_app_key,
                        "pageNo": "1",
                        "numOfRows": "5",
                        "type": "json",
                    },
                )
                log.info("  HTTP %d  content-type=%s  bytes=%d",
                         resp.status_code,
                         resp.headers.get("content-type", "?"),
                         len(resp.content))
                # Peek body
                body = resp.text[:500].replace("\n", " ")
                log.info("  body[:500]: %s", body)
            except Exception as e:  # noqa: BLE001
                log.warning("  ERROR: %s: %s", type(e).__name__, e)


asyncio.run(main())
