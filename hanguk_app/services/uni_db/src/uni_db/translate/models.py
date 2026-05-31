"""Shared dataclasses for the translation pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from uuid import UUID

TargetLang = Literal["en", "uz", "vi", "mn", "ru", "id"]
ProviderName = Literal["claude", "deepl", "papago", "human", "mock"]


@dataclass(frozen=True, slots=True)
class TranslationRequest:
    entity_type: str
    entity_id: UUID
    field_name: str
    source_text_ko: str
    target_lang: TargetLang


@dataclass(frozen=True, slots=True)
class TranslationOutput:
    text_value: str
    provider: ProviderName
    confidence: float
    back_trans_distance: float | None = None
    via_pivot: bool = False
