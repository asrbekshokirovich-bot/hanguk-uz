"""Reliability verification gauntlet for extracted guideline data.

A guideline PDF that the crawler finds is put through a multi-check gauntlet
BEFORE any of its data is shown to a staff member, and nothing is published
until a human approves it. The gates (see `docs/uni_db/reliability-verification-design.md`):

  0. identity   — is this the exact right university's current foreign-applicant
                  guideline? (rejects wrong PDFs before we spend a cent extracting)
  1. extraction — per-field-group Claude extraction, only the required fields
  2. grounding  — every value must be backed by a verbatim source quote that
                  actually appears in the PDF (deterministic + LLM judge)
  3. consensus  — N independent re-extractions must agree on the critical fields
  4. critics    — adversarial accuracy / completeness / scope agents try to break it
  5. sanity     — deterministic range/order/cycle checks (free, 100% reliable)
  6. aggregate  — combine into a green/amber/red ReliabilityReport
  7. HITL       — every guideline waits in review_queue for staff approval

The pure checks (sanity, deterministic grounding, consensus diff, aggregation)
live in `checks.py` / `engine.py` and need no network. The LLM gates (identity,
grounding judge, critics) live in `agents.py` with injectable callables so the
whole engine unit-tests offline.
"""

from .engine import ReliabilityReport, aggregate, verify_extraction
from .models import (
    ConsensusField,
    CriticIssue,
    GroundingIssue,
    IdentityVerdict,
    SanityIssue,
)

__all__ = [
    "ConsensusField",
    "CriticIssue",
    "GroundingIssue",
    "IdentityVerdict",
    "ReliabilityReport",
    "SanityIssue",
    "aggregate",
    "verify_extraction",
]
