"""Schema-guided pruning — validation strips unknown keys instead of rejecting.

The largest class of failed extraction jobs was schema strictness: the model
correctly extracted a field the PDF really contains (is_notarization_required,
label_ko, duration, …) that the field-group schema didn't model, and
`jsonschema.validate` rejected the WHOLE job for it. That threw away every
good row alongside the one unexpected key.

This module inverts that: before validation, unknown properties are STRIPPED
from the payload — but only at levels where the schema declares
`additionalProperties: False` (levels that tolerate extras keep them, exactly
as validation would). The dropped key paths are returned so the caller can log
them into the extraction job, and the untouched raw model output is preserved
separately in `raw_output`. After pruning, a job may only fail validation for
a real structural problem (a required core field absent, a broken type) — and
the caller retries once with the validator errors appended to the prompt.

Pure / no IO.
"""

from __future__ import annotations

from typing import Any

from .schemas import FIELD_GROUP_SCHEMAS


def prune_to_schema(field_group: str, parsed: Any) -> tuple[Any, tuple[str, ...]]:
    """Strip properties the field-group schema would reject.

    Returns `(pruned_copy, dropped_key_paths)`. The input is not mutated.
    Only object levels with `additionalProperties: False` are pruned; levels
    that allow extras (`additionalProperties: True` / unspecified) pass
    through unchanged, matching what validation would accept.
    """
    schema = FIELD_GROUP_SCHEMAS.get(field_group)
    if schema is None:
        return parsed, ()
    dropped: list[str] = []
    pruned = _prune(schema, parsed, "$", dropped)
    return pruned, tuple(dropped)


def _prune(schema: Any, value: Any, path: str, dropped: list[str]) -> Any:
    if not isinstance(schema, dict):
        return value

    if isinstance(value, dict):
        props = schema.get("properties")
        if not isinstance(props, dict):
            return value
        strict = schema.get("additionalProperties", True) is False
        out: dict[str, Any] = {}
        for key, sub in value.items():
            if key in props:
                out[key] = _prune(props[key], sub, f"{path}.{key}", dropped)
            elif strict:
                dropped.append(f"{path}.{key}")
            else:
                out[key] = sub
        return out

    if isinstance(value, list):
        items = schema.get("items")
        if not isinstance(items, dict):
            return value
        return [
            _prune(items, entry, f"{path}[{i}]", dropped)
            for i, entry in enumerate(value)
        ]

    return value
