"""Extract Uzum auth material from a browser "Copy as cURL" command.

Grabbing a fresh token by hand is fiddly, so instead you can copy any
``graphql.uzum.uz`` request from your browser's Network tab as cURL and let this
module pull out the ``authorization`` token, ``x-iid`` and ``accept-language``.

Supports the bash-style cURL that Chrome, Firefox and Edge emit (``-H 'k: v'``).
"""

from __future__ import annotations

import re
import shlex
from dataclasses import dataclass


@dataclass
class ImportedAuth:
    auth_token: str = ""
    iid: str = ""
    language: str = ""
    headers: dict[str, str] | None = None

    @property
    def ok(self) -> bool:
        return bool(self.auth_token)


def parse_curl(command: str) -> ImportedAuth:
    """Parse a cURL command string and return the auth material it carries."""
    headers = _extract_headers(command)
    lower = {k.lower(): v for k, v in headers.items()}

    token = lower.get("authorization", "").strip()
    # Tokens are usually "Bearer xxx"; keep the raw credential only.
    token = re.sub(r"^Bearer\s+", "", token, flags=re.IGNORECASE).strip()

    language = lower.get("accept-language", "").split(",")[0].strip()

    return ImportedAuth(
        auth_token=token,
        iid=lower.get("x-iid", "").strip(),
        language=language,
        headers=headers,
    )


def _extract_headers(command: str) -> dict[str, str]:
    # Normalise line continuations from multi-line copies (bash "\" and Windows "^").
    cleaned = command.replace("\\\n", " ").replace("^\n", " ").replace("\n", " ")
    try:
        tokens = shlex.split(cleaned)
    except ValueError:
        # Unbalanced quotes: fall back to a regex sweep over -H arguments.
        return _extract_headers_regex(command)

    headers: dict[str, str] = {}
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        value: str | None = None
        if tok in ("-H", "--header") and i + 1 < len(tokens):
            value = tokens[i + 1]
            i += 2
        elif tok.startswith("-H") and len(tok) > 2:
            value = tok[2:]
            i += 1
        elif tok.startswith("--header="):
            value = tok[len("--header=") :]
            i += 1
        else:
            i += 1
            continue
        if value and ":" in value:
            name, _, val = value.partition(":")
            headers[name.strip()] = val.strip()
    if not headers:
        return _extract_headers_regex(command)
    return headers


def _extract_headers_regex(command: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    pattern = re.compile(r"""-H\s+(['"])(.*?)\1""", re.DOTALL)
    for _, raw in pattern.findall(command):
        if ":" in raw:
            name, _, val = raw.partition(":")
            headers[name.strip()] = val.strip()
    return headers
