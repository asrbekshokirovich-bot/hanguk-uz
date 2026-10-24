"""Exception hierarchy for the scraper."""

from __future__ import annotations


class UzumError(Exception):
    """Base class for every error raised by this package."""


class ConfigError(UzumError):
    """Raised when configuration is missing or invalid."""


class UzumHTTPError(UzumError):
    """Raised for non-success HTTP responses that are not handled elsewhere."""

    def __init__(self, status_code: int, message: str, *, url: str | None = None):
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code}{f' for {url}' if url else ''}: {message}")


class AuthError(UzumHTTPError):
    """Raised on 401/403 — the token is missing, invalid, or expired."""


class NotFoundError(UzumHTTPError):
    """Raised on 404 — the requested product/shop/category does not exist."""


class RateLimitedError(UzumHTTPError):
    """Raised on 429 after retries are exhausted."""


class GraphQLError(UzumError):
    """Raised when the GraphQL endpoint returns an `errors` array."""

    def __init__(self, errors: list[dict]):
        self.errors = errors
        messages = "; ".join(str(e.get("message", e)) for e in errors) or "unknown GraphQL error"
        super().__init__(messages)
