"""Rich-backed logging configuration shared by the CLI and library."""

from __future__ import annotations

import logging

try:
    from rich.logging import RichHandler

    _HAS_RICH = True
except Exception:  # pragma: no cover - rich is a hard dep, but degrade gracefully
    _HAS_RICH = False


def setup_logging(verbosity: int = 0) -> logging.Logger:
    """Configure the root ``uzum_scraper`` logger.

    verbosity: 0 => INFO, 1 => DEBUG, >=2 => DEBUG incl. httpx wire logs.
    """
    level = logging.DEBUG if verbosity >= 1 else logging.INFO

    handler: logging.Handler
    if _HAS_RICH:
        handler = RichHandler(rich_tracebacks=True, show_path=False, markup=False)
        fmt = "%(message)s"
    else:  # pragma: no cover
        handler = logging.StreamHandler()
        fmt = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"

    root = logging.getLogger("uzum_scraper")
    root.handlers.clear()
    root.setLevel(level)
    handler.setFormatter(logging.Formatter(fmt, datefmt="%H:%M:%S"))
    root.addHandler(handler)
    root.propagate = False

    # httpx is very chatty; only surface its logs at high verbosity.
    logging.getLogger("httpx").setLevel(logging.WARNING if verbosity < 2 else logging.DEBUG)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    return root


def get_logger(name: str = "uzum_scraper") -> logging.Logger:
    return logging.getLogger(name)
