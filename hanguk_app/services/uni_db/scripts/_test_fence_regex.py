"""Test _FENCE_RE / _strip_fences against the patterns we know Claude emits."""

from __future__ import annotations

import sys

from uni_db.extract.llm_anthropic import _strip_fences

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TESTS = [
    ("bare JSON, no fence",
     '{"foo": "bar"}',
     '{"foo": "bar"}'),
    ("standard fenced JSON",
     '```json\n{"foo": "bar"}\n```',
     '{"foo": "bar"}'),
    ("fenced with leading whitespace",
     '   ```json\n{"foo": "bar"}\n```  ',
     '{"foo": "bar"}'),
    ("fence with UPPER json",
     '```JSON\n{"foo": "bar"}\n```',
     '{"foo": "bar"}'),
    ("fence with no language tag",
     '```\n{"foo": "bar"}\n```',
     '{"foo": "bar"}'),
    ("fence open, NO closing fence (truncated)",
     '```json\n{"applicant_category": "외국인전형",\n  "document_type": "모집요강"',
     '{"applicant_category": "외국인전형",\n  "document_type": "모집요강"'),
    ("KAIST-like reconstruction from Job #1 raw",
     '```json\n{\n  "applicant_category": "외국인전형",\n  "document_type": "모집요강",\n  "is_correction_notice": false,\n  "institution": "KAIST",\n  "program_level": "undergraduate",\n  "admission_cycles": [\n    {\n     ',
     '<expect non-empty extracted JSON body>'),
]

for label, inp, expected in TESTS:
    out = _strip_fences(inp)
    ok = out.strip().startswith("{") and len(out) > 0
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    print(f"  input  ({len(inp)} chars):  {inp[:80]!r}{'...' if len(inp) > 80 else ''}")
    print(f"  output ({len(out)} chars):  {out[:80]!r}{'...' if len(out) > 80 else ''}")
    print()
