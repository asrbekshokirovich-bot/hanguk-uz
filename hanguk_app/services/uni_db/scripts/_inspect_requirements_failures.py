"""Phase 0 recon: pull every `requirements` extraction_jobs row for KAIST
PDFs and surface the actual hallucination patterns so the fix can be
targeted at the real failure mode (not the hypothesized one).
"""

from __future__ import annotations

import asyncio
import json
import sys
from textwrap import shorten

import asyncpg

from uni_db.config import settings

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def main() -> int:
    if not settings.supabase_db_url:
        print("FATAL: SUPABASE_DB_URL not set")
        return 1
    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        # 1) Schema introspection — confirm column names before we query
        cols = await conn.fetch(
            "select column_name, data_type from information_schema.columns "
            "where table_schema='public' and table_name='extraction_jobs' "
            "order by ordinal_position"
        )
        print(f"=== extraction_jobs columns ({len(cols)}) ===")
        for r in cols:
            print(f"  {r['column_name']:30s} {r['data_type']}")
        print()

        kaist_id = await conn.fetchval(
            "select id from public.institutions where name_ko='한국과학기술원'"
        )
        print(f"KAIST institution_id: {kaist_id}")
        if not kaist_id:
            print("FATAL: no KAIST row in public.institutions")
            return 1

        # 2) Discover guideline_documents column names first
        gd_cols = await conn.fetch(
            "select column_name from information_schema.columns "
            "where table_schema='public' and table_name='guideline_documents' "
            "order by ordinal_position"
        )
        print(f"\n=== guideline_documents columns ({len(gd_cols)}) ===")
        print("  " + ", ".join(r["column_name"] for r in gd_cols))

        # 3) All KAIST guideline_documents
        gd_rows = await conn.fetch(
            "select * from public.guideline_documents where institution_id = $1 "
            "order by fetched_at",
            kaist_id,
        )
        print(f"\n=== KAIST guideline_documents ({len(gd_rows)}) ===")
        for r in gd_rows:
            print(f"  id={r['id']}  status_keys={[k for k in r.keys() if 'status' in k or 'archetype' in k]}")
            for k in r.keys():
                if "archetype" in k or "status" in k or "storage_path" in k:
                    print(f"    {k}: {r[k]}")

        # 4) All requirements + basic_requirements jobs for KAIST
        jobs = await conn.fetch(
            """
            select ej.*, gd.storage_path
            from public.extraction_jobs ej
            join public.guideline_documents gd
              on gd.id = ej.guideline_document_id
            where gd.institution_id = $1
              and ej.field_group in ('requirements','basic_requirements')
            order by ej.started_at nulls last
            """,
            kaist_id,
        )
        print(f"\n=== KAIST requirements extraction_jobs ({len(jobs)}) ===")
        for i, r in enumerate(jobs, 1):
            print(f"\n--- Job #{i}  id={r['id']} ---")
            print(f"  guideline:    {r['storage_path']}")
            print(f"  status:       {r['status']}")
            print(f"  started_at:   {r['started_at']}")
            print(f"  ended_at:     {r['ended_at']}")
            print(f"  field_group:  {r['field_group']}")
            print(f"  archetype:    {r['archetype']}")
            print(f"  llm_model:    {r['llm_model']}")
            print(f"  tokens:       in={r['input_tokens']} out={r['output_tokens']}")
            print(f"  acc_score:    {r['accuracy_self_score']}")
            if r["error_text"]:
                print(f"  error_text:   {shorten(str(r['error_text']), 300)}")
            if r["parsed_output"]:
                try:
                    parsed = (
                        r["parsed_output"]
                        if isinstance(r["parsed_output"], dict)
                        else json.loads(r["parsed_output"])
                    )
                except (TypeError, json.JSONDecodeError):
                    parsed = r["parsed_output"]
                print(f"  parsed_output keys: {sorted(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__}")
                print(f"  parsed_output ({len(json.dumps(parsed, ensure_ascii=False))} chars):")
                pretty = json.dumps(parsed, ensure_ascii=False, indent=2)
                # cap each output at ~1500 chars
                if len(pretty) > 1500:
                    print(pretty[:1500] + "\n  ... [truncated]")
                else:
                    print(pretty)
            if r["raw_output"] and not r["parsed_output"]:
                raw = str(r["raw_output"])
                print(f"  raw_output ({len(raw)} chars), first 800:")
                print(f"  {raw[:800]}")

        # 5) review_queue rows touching KAIST — first introspect, then query
        rq_cols = await conn.fetch(
            "select column_name from information_schema.columns "
            "where table_schema='public' and table_name='review_queue' "
            "order by ordinal_position"
        )
        print(f"\n=== review_queue columns ===")
        print("  " + ", ".join(r["column_name"] for r in rq_cols))
        rq_col_names = {r["column_name"] for r in rq_cols}
        # Build a defensive query — older schemas may not have a direct
        # guideline_document_id FK on review_queue (uses entity_id/entity_type).
        if "guideline_document_id" in rq_col_names:
            rq = await conn.fetch(
                """
                select rq.*, gd.storage_path
                from public.review_queue rq
                join public.guideline_documents gd
                  on gd.id = rq.guideline_document_id
                where gd.institution_id = $1
                """,
                kaist_id,
            )
        else:
            # entity-pointer style — join via extraction_jobs
            rq = await conn.fetch(
                """
                select rq.*, gd.storage_path
                from public.review_queue rq
                left join public.extraction_jobs ej
                  on rq.entity_type='extraction_jobs' and ej.id::text = rq.entity_id::text
                left join public.guideline_documents gd
                  on gd.id = ej.guideline_document_id
                where (gd.institution_id = $1) or (rq.entity_type='extraction_jobs' and ej.id in (
                    select ej2.id from public.extraction_jobs ej2
                    join public.guideline_documents gd2 on gd2.id=ej2.guideline_document_id
                    where gd2.institution_id=$1
                ))
                """,
                kaist_id,
            )
        print(f"\n=== KAIST review_queue rows ({len(rq)}) ===")
        for r in rq:
            keys = list(r.keys())
            preview = {k: shorten(str(r[k] or ''), 120) for k in keys if k not in ('id',)}
            print(f"  {preview}")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
