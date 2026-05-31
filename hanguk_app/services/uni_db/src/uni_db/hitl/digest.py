"""Markdown digest assembler for the HITL review queue.

Plan §G.1 / §M (KPIs). Pure formatter — feed it dataclasses or
namedtuples / dicts shaped like the underlying view rows and it returns
a ready-to-paste Markdown report. The CLI wires this to live SQL when a
DB URL is configured.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True, slots=True)
class QueueRow:
    id: str
    priority: int
    reason: str
    entity_type: str
    entity_id: str
    name_ko: str | None
    name_en: str | None
    source_url_ko: str | None
    created_at: datetime


@dataclass(frozen=True, slots=True)
class ArchetypeAccuracy:
    archetype: str
    total_decided: int
    approved_as_is: int
    approved_with_edits: int
    rejected: int
    approved_as_is_pct: float | None


@dataclass(frozen=True, slots=True)
class OverdueRow:
    id: str
    priority: int
    age_hours: float
    name_ko: str | None
    name_en: str | None


def render_digest(
    *,
    queue: list[QueueRow],
    accuracy: list[ArchetypeAccuracy],
    overdue: list[OverdueRow],
    now: datetime | None = None,
) -> str:
    """Assemble the full digest. Stable Markdown so prompt-style snapshot
    tests can diff it byte-for-byte across runs."""
    moment = (now or datetime.now(tz=timezone.utc)).strftime("%Y-%m-%d %H:%M UTC")
    sections: list[str] = [f"# HITL review queue — {moment}", ""]

    sections.extend(_render_queue_section(queue))
    sections.append("")
    sections.extend(_render_overdue_section(overdue))
    sections.append("")
    sections.extend(_render_accuracy_section(accuracy))

    return "\n".join(sections).rstrip() + "\n"


def _render_queue_section(queue: list[QueueRow]) -> list[str]:
    by_priority: dict[int, int] = {}
    for r in queue:
        by_priority[r.priority] = by_priority.get(r.priority, 0) + 1

    out: list[str] = ["## Open queue"]
    if not queue:
        out.append("")
        out.append("_No open items._")
        return out

    out.append("")
    out.append("| Priority | Open count |")
    out.append("|---:|---:|")
    for p in sorted(by_priority):
        out.append(f"| P{p} | {by_priority[p]} |")
    out.append("")
    out.append("### Top items")
    out.append("")
    out.append("| Priority | Reason | Institution | Entity |")
    out.append("|---:|:--|:--|:--|")
    for r in queue[:10]:
        inst = r.name_ko or r.name_en or "(unknown)"
        out.append(
            f"| P{r.priority} | {r.reason} | {inst} | "
            f"`{r.entity_type}#{_short(r.entity_id)}` |"
        )
    return out


def _render_overdue_section(overdue: list[OverdueRow]) -> list[str]:
    out = ["## Overdue items"]
    if not overdue:
        out.append("")
        out.append("_None overdue. Nice._")
        return out
    out.append("")
    out.append("| Priority | Age (h) | Institution |")
    out.append("|---:|---:|:--|")
    for r in overdue:
        inst = r.name_ko or r.name_en or "(unknown)"
        out.append(f"| P{r.priority} | {r.age_hours:.1f} | {inst} |")
    return out


def _render_accuracy_section(accuracy: list[ArchetypeAccuracy]) -> list[str]:
    out = ["## Extraction accuracy by archetype"]
    if not accuracy:
        out.append("")
        out.append("_Insufficient decisions to compute accuracy._")
        return out
    out.append("")
    out.append("| Archetype | Decided | As-is | Edits | Rejected | As-is % |")
    out.append("|:--:|---:|---:|---:|---:|---:|")
    for a in accuracy:
        pct = f"{a.approved_as_is_pct:.1f}%" if a.approved_as_is_pct is not None else "—"
        out.append(
            f"| {a.archetype or '—'} | {a.total_decided} | "
            f"{a.approved_as_is} | {a.approved_with_edits} | {a.rejected} | {pct} |"
        )
    return out


def _short(uuid_or_id: str) -> str:
    return uuid_or_id[:8] if uuid_or_id else "?"
