"""Phase 3 of the requirements-hallucination fix.

Re-runs the 'requirements' field-group extraction for the 3 existing KAIST
guideline_documents in staging, using the NEW schema + prompt. Reports
the parsed output without writing to DB by default — pass --commit to
upsert the new extraction_jobs rows.

Cost: 3 PDFs × 1 field group × ~$0.05 = ~$0.15 of Anthropic.

Requires:
  UNI_DB_LIVE_APIS=true  (so extract_field_group hits real Anthropic)
  ANTHROPIC_API_KEY set in .env
  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (to download PDFs from Storage)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Force-load .env into os.environ BEFORE importing the settings module.
# pydantic_settings's `env_file=".env"` reads via its own path resolver
# which (on this machine, anyway) returns empty for ANTHROPIC_API_KEY
# even though python-dotenv reads it correctly. Workaround: populate
# os.environ ourselves, then pydantic picks it up from there.
from dotenv import load_dotenv as _load_dotenv  # noqa: E402

_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
_load_dotenv(_ENV_PATH, override=True)

import asyncpg  # noqa: E402
import httpx  # noqa: E402
import jsonschema  # noqa: E402

from uni_db.config import settings  # noqa: E402
from uni_db.extract.archetype import find_section_offsets  # noqa: E402
from uni_db.extract.llm_anthropic import extract_field_group  # noqa: E402
from uni_db.extract.schemas import REQUIREMENTS_SCHEMA  # noqa: E402
from uni_db.parse.extract_orchestrator import extract as extract_pdf  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("requirements_reextract")

KAIST_NAME = "한국과학기술원"


def _slice_for_requirements(full_text: str, offsets: dict[str, int]) -> str:
    """Mirror parse_worker._slice_for() for the requirements group."""
    if "requirements" not in offsets:
        return full_text[:8000]
    start = offsets["requirements"]
    return full_text[start : start + 12000]


async def main(args: argparse.Namespace) -> int:
    if not settings.live_apis:
        log.error(
            "settings.live_apis is False — extract_field_group will return the "
            "deterministic mock. Re-run with UNI_DB_LIVE_APIS=true."
        )
        return 1
    if not settings.anthropic_api_key:
        log.error("ANTHROPIC_API_KEY not set.")
        return 1

    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        kaist_id = await conn.fetchval(
            "select id from public.institutions where name_ko = $1", KAIST_NAME
        )
        if not kaist_id:
            log.error(f"No institution row for {KAIST_NAME}")
            return 1

        # Staging bucket `guideline-blobs` is missing — fetch fresh PDFs
        # from the announcement attachment URLs instead. Gives us a true
        # end-to-end live test on real KAIST content.
        gd_rows = await conn.fetch(
            """
            select gd.id            as gd_id,
                   gd.archetype     as archetype,
                   gd.file_hash_sha256,
                   a.attachments::text as attachments_json,
                   a.url_ko         as ann_url_ko,
                   s.url_ko         as source_url_ko
              from public.guideline_documents gd
              join public.announcements a   on a.guideline_document_id = gd.id
              join public.announcement_sources s on s.id = a.source_id
             where gd.institution_id = $1
             order by gd.fetched_at
            """,
            kaist_id,
        )
        log.info("Found %d KAIST guideline_documents w/ attachments", len(gd_rows))

        async with httpx.AsyncClient(
            headers={"User-Agent": settings.http_user_agent},
            follow_redirects=True,
            timeout=settings.http_request_timeout_sec,
        ) as http:
            results = []
            for gd in gd_rows:
                log.info("--- Processing %s (archetype %s) ---", str(gd["gd_id"])[:8], gd["archetype"])
                attachments = json.loads(gd["attachments_json"] or "[]")
                pdf = next(
                    (a for a in attachments if (a.get("url") or "").lower().endswith(".pdf")),
                    attachments[0] if attachments else None,
                )
                if not pdf or not pdf.get("url"):
                    log.warning("    no PDF attachment, skipping")
                    continue
                log.info("    fetching %s", pdf["url"][:100])
                resp = await http.get(
                    pdf["url"],
                    headers={"Referer": gd["source_url_ko"]},
                )
                resp.raise_for_status()
                blob = resp.content
                log.info("    downloaded %d bytes", len(blob))

                # 2) Extract text
                extracted, decision = extract_pdf(blob)
                log.info(
                    "    pdf: pages=%d tier=%s chars/page=%.0f",
                    extracted.page_count, decision.tier, decision.chars_per_page_avg,
                )

                # 3) Section offsets + slice for requirements
                offsets = find_section_offsets(extracted.text)
                section = _slice_for_requirements(extracted.text, offsets)
                log.info(
                    "    requirements section: %d chars (offsets had requirements=%s)",
                    len(section),
                    "yes" if "requirements" in offsets else "no (fallback to first 8k)",
                )

                # 4) Live Anthropic call with new prompt + new schema
                result = extract_field_group(
                    field_group="requirements",
                    archetype=gd["archetype"],
                    source_text_ko=section,
                )
                log.info(
                    "    LLM: in=%d out=%d cost=$%.5f acc=%.2f",
                    result.input_tokens, result.output_tokens,
                    result.cost_usd, result.accuracy_self_score,
                )

                # 5) Schema validation
                try:
                    jsonschema.validate(
                        instance=result.parsed_output, schema=REQUIREMENTS_SCHEMA
                    )
                    schema_ok = True
                    schema_err = None
                except jsonschema.ValidationError as e:
                    schema_ok = False
                    schema_err = e.message[:200]

                rows_count = len(result.parsed_output.get("rows", []))
                log.info(
                    "    SCHEMA: %s  rows=%d  err=%s",
                    "OK" if schema_ok else "FAIL", rows_count, schema_err or "",
                )

                # Pretty-print the parsed output
                print(f"\n=== guideline_document {str(gd['gd_id'])[:8]}  archetype={gd['archetype']} ===")
                print(json.dumps(result.parsed_output, ensure_ascii=False, indent=2)[:2000])
                print("===\n")

                results.append({
                    "gd_id": str(gd["gd_id"]),
                    "archetype": gd["archetype"],
                    "schema_ok": schema_ok,
                    "rows": rows_count,
                    "cost_usd": result.cost_usd,
                    "result": result,
                })

        total_cost = sum(r["cost_usd"] for r in results)
        ok_count = sum(1 for r in results if r["schema_ok"])
        log.info(
            "SUMMARY: %d/%d schema-clean, total_cost=$%.5f",
            ok_count, len(results), total_cost,
        )

        if args.commit:
            log.info("--commit set: writing new extraction_jobs rows to staging")
            for r in results:
                ej = r["result"]
                await conn.execute(
                    """
                    insert into public.extraction_jobs (
                      guideline_document_id, archetype, field_group, status,
                      llm_provider, llm_model,
                      input_tokens, output_tokens, cost_usd, latency_ms,
                      accuracy_self_score, raw_output, parsed_output,
                      started_at, ended_at
                    ) values (
                      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                      $12::jsonb, $13::jsonb, now(), now()
                    )
                    """,
                    r["gd_id"], r["archetype"], "requirements",
                    "succeeded" if r["schema_ok"] else "failed",
                    "anthropic", ej.llm_model,
                    ej.input_tokens, ej.output_tokens, ej.cost_usd, ej.latency_ms,
                    ej.accuracy_self_score,
                    json.dumps({"raw": ej.raw_output}, ensure_ascii=False),
                    json.dumps(ej.parsed_output, ensure_ascii=False),
                )
            log.info("Wrote %d new extraction_jobs rows", len(results))
        else:
            log.info("(dry-run; pass --commit to persist results to DB)")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--commit", action="store_true",
                        help="Write new extraction_jobs rows to staging "
                             "(default: dry-run, print only)")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args)))
