"""Configuration loading and precedence.

Precedence, highest wins:
    explicit CLI overrides  >  YAML config file  >  environment / .env  >  defaults
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from .errors import ConfigError

DEFAULTS: dict[str, Any] = {
    "auth_token": "",
    "iid": "",
    "language": "uz-UZ",
    "min_delay": 0.7,
    "jitter": 0.6,
    "max_retries": 5,
    "timeout": 30.0,
    "rest_base": "https://api.uzum.uz/api",
    "graphql_url": "https://graphql.uzum.uz/",
    "output_dir": "./data",
}

# Mapping of config key -> environment variable name.
_ENV_MAP = {
    "auth_token": "UZUM_AUTH_TOKEN",
    "iid": "UZUM_IID",
    "language": "UZUM_LANGUAGE",
    "min_delay": "UZUM_MIN_DELAY",
    "jitter": "UZUM_JITTER",
    "max_retries": "UZUM_MAX_RETRIES",
    "timeout": "UZUM_TIMEOUT",
    "rest_base": "UZUM_REST_BASE",
    "graphql_url": "UZUM_GRAPHQL_URL",
    "output_dir": "UZUM_OUTPUT_DIR",
}

_SUPPORTED_LANGUAGES = {"uz-UZ", "ru-RU", "en-US"}


def _iid_cache_path() -> Path:
    base = os.environ.get("XDG_CONFIG_HOME") or os.path.join(Path.home(), ".config")
    return Path(base) / "uzum-scraper" / "iid"


def _load_or_create_iid() -> str:
    """Return a stable installation id, generating & caching one on first use."""
    path = _iid_cache_path()
    try:
        if path.is_file():
            cached = path.read_text(encoding="utf-8").strip()
            if cached:
                return cached
    except OSError:
        pass
    generated = str(uuid.uuid4())
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(generated, encoding="utf-8")
    except OSError:
        # Non-fatal: fall back to an ephemeral id for this run.
        pass
    return generated


@dataclass
class Config:
    """Resolved runtime configuration."""

    auth_token: str = ""
    iid: str = ""
    language: str = "uz-UZ"
    min_delay: float = 0.7
    jitter: float = 0.6
    max_retries: int = 5
    timeout: float = 30.0
    rest_base: str = "https://api.uzum.uz/api"
    graphql_url: str = "https://graphql.uzum.uz/"
    output_dir: str = "./data"

    # Populated during load() but not part of the persisted config surface.
    _has_token: bool = field(default=False, repr=False)

    # -- construction -------------------------------------------------------
    @classmethod
    def load(
        cls,
        config_path: str | os.PathLike | None = None,
        overrides: dict[str, Any] | None = None,
        *,
        env_file: str | os.PathLike | None = ".env",
    ) -> Config:
        """Build a Config from every source, applying precedence."""
        if env_file and Path(env_file).is_file():
            load_dotenv(env_file, override=False)

        values: dict[str, Any] = dict(DEFAULTS)

        # environment layer
        for key, env_name in _ENV_MAP.items():
            raw = os.environ.get(env_name)
            if raw is not None and raw != "":
                values[key] = raw

        # yaml layer
        if config_path:
            values.update(_read_yaml(config_path))

        # explicit override layer (CLI). Ignore None so unset flags don't clobber.
        if overrides:
            for key, val in overrides.items():
                if val is not None:
                    values[key] = val

        return cls._from_values(values)

    @classmethod
    def _from_values(cls, values: dict[str, Any]) -> Config:
        known = {f.name for f in fields(cls) if not f.name.startswith("_")}
        clean = {k: v for k, v in values.items() if k in known}

        # Coerce numeric types (env & yaml can arrive as strings).
        for k in ("min_delay", "jitter", "timeout"):
            if k in clean:
                clean[k] = _as_float(clean[k], k)
        if "max_retries" in clean:
            clean["max_retries"] = _as_int(clean["max_retries"], "max_retries")

        cfg = cls(**clean)
        cfg._validate()
        cfg._has_token = bool(cfg.auth_token)
        if not cfg.iid:
            cfg.iid = _load_or_create_iid()
        cfg.auth_token = cfg.auth_token.removeprefix("Bearer ").strip()
        return cfg

    # -- helpers ------------------------------------------------------------
    def _validate(self) -> None:
        if self.language not in _SUPPORTED_LANGUAGES:
            raise ConfigError(
                f"Unsupported language {self.language!r}; expected one of "
                f"{', '.join(sorted(_SUPPORTED_LANGUAGES))}"
            )
        if self.min_delay < 0 or self.jitter < 0:
            raise ConfigError("min_delay and jitter must be non-negative")
        if self.max_retries < 0:
            raise ConfigError("max_retries must be non-negative")
        if self.timeout <= 0:
            raise ConfigError("timeout must be positive")

    @property
    def has_token(self) -> bool:
        return bool(self.auth_token)

    def require_token(self) -> None:
        if not self.has_token:
            raise ConfigError(
                "No Uzum auth token configured. Set UZUM_AUTH_TOKEN (see .env.example) "
                "or import one with `uzum-scraper auth --from-curl-file curl.txt`. "
                "See the README section 'Getting a token'."
            )

    def redacted(self) -> dict[str, Any]:
        """Config as a dict with the token masked — safe to log / write to manifests."""
        out = {f.name: getattr(self, f.name) for f in fields(self) if not f.name.startswith("_")}
        if out.get("auth_token"):
            tok = out["auth_token"]
            out["auth_token"] = f"***{tok[-4:]}" if len(tok) > 4 else "***"
        return out


def _read_yaml(path: str | os.PathLike) -> dict[str, Any]:
    p = Path(path)
    if not p.is_file():
        raise ConfigError(f"Config file not found: {p}")
    try:
        import yaml
    except ImportError as exc:  # pragma: no cover
        raise ConfigError("PyYAML is required to read a --config file") from exc
    try:
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        raise ConfigError(f"Invalid YAML in {p}: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigError(f"Config file {p} must contain a mapping at the top level")
    return data


def _as_float(value: Any, name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"{name} must be a number, got {value!r}") from exc


def _as_int(value: Any, name: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"{name} must be an integer, got {value!r}") from exc
