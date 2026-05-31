"""Upstream / bulk-data adapters.

While `discovery/adapters/` polls individual university announcement
boards, this package consumes bulk public-data APIs that cover many
universities per call:

* MOE okep — https://okep.moe.go.kr/  (already wired as a per-source
  announcement board; could be upgraded to bulk API if MoE exposes one).
* Adiga — 어디가 (https://www.adiga.kr/). KCUE-published admissions
  calendar covers ~330 institutions per pull. ADIGA_APP_KEY required.
* data.go.kr — National public-data portal. Several admissions-relevant
  datasets exist (KCUE 모집정원, 대학기본통계, 등록금 등).
  DATA_GO_KR_APP_KEY required (one key, multiple dataset auths).
* Study in Korea / NIIED — outbound-student MoE programs.

Each upstream adapter follows the same contract as discovery adapters:
returns `Announcement` / `PostDetail` objects so the rest of the
pipeline (change_detection, parse_worker, translation) is uniform.
"""

from __future__ import annotations
