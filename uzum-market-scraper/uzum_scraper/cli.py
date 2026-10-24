"""Command-line interface for the Uzum Market scraper.

uzum-scraper doctor
uzum-scraper auth --from-curl-file curl.txt
uzum-scraper categories
uzum-scraper category 10020 --sort orders --max 500 --with-reviews
uzum-scraper search "iphone 15" --max 200
uzum-scraper shop "some-shop-slug" --with-details
uzum-scraper product 123456
uzum-scraper reviews 123456 --max 1000
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx

from . import __version__, pipeline, queries
from .client import UzumClient
from .config import Config
from .curl_import import parse_curl
from .errors import ConfigError, UzumError
from .logging_setup import get_logger, setup_logging

log = get_logger("uzum_scraper.cli")


# ---------------------------------------------------------------------------
# argument parsing
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    # Global options live on a shared parent parser so they are accepted BOTH
    # before and after the subcommand (e.g. `--token X doctor` and
    # `doctor --token X`). SUPPRESS defaults avoid the argparse gotcha where a
    # subparser's default would clobber a value given at the top level.
    parent = _global_parent()

    parser = argparse.ArgumentParser(
        prog="uzum-scraper",
        description="Scrape products, sale counts, ratings, reviews & shops from Uzum Market.",
        parents=[parent],
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")

    sub = parser.add_subparsers(dest="command", required=True, metavar="<command>")

    sub.add_parser("doctor", parents=[parent], help="check connectivity & auth against Uzum")

    p_auth = sub.add_parser(
        "auth", parents=[parent], help="import a token from a browser 'Copy as cURL'"
    )
    src = p_auth.add_mutually_exclusive_group(required=True)
    src.add_argument("--from-curl-file", metavar="FILE", help="file containing a cURL command")
    src.add_argument("--from-curl", metavar="CURL", help="a cURL command string")
    p_auth.add_argument("--env-file", default=".env", help="dotenv file to write to")

    sub.add_parser("categories", parents=[parent], help="scrape the full category tree")

    p_cat = sub.add_parser("category", parents=[parent], help="scrape products in a category")
    p_cat.add_argument("category_id", help="numeric category id (see `categories`)")
    _add_catalog_flags(p_cat)

    p_search = sub.add_parser("search", parents=[parent], help="scrape products matching a query")
    p_search.add_argument("text", help="search text")
    p_search.add_argument("--category", dest="category_id", help="restrict to a category id")
    _add_catalog_flags(p_search)

    p_shop = sub.add_parser("shop", parents=[parent], help="scrape a shop's profile and catalog")
    p_shop.add_argument("shop_name", help="shop slug/name (from its uzum.uz/shop/<name> URL)")
    p_shop.add_argument("--shop-id", help="numeric shop id, if you already know it")
    _add_catalog_flags(p_shop)

    p_prod = sub.add_parser(
        "product", parents=[parent], help="scrape one product's full details + reviews"
    )
    p_prod.add_argument("product_id", help="numeric product id")
    p_prod.add_argument("--no-reviews", action="store_true", help="skip reviews")
    p_prod.add_argument("--max-reviews", type=int, default=500, help="cap reviews collected")

    p_rev = sub.add_parser("reviews", parents=[parent], help="scrape only the reviews of a product")
    p_rev.add_argument("product_id", help="numeric product id")
    p_rev.add_argument("--max", dest="max_reviews", type=int, default=None, help="cap reviews")

    return parser


def _global_parent() -> argparse.ArgumentParser:
    parent = argparse.ArgumentParser(add_help=False)
    g = parent.add_argument_group("global options")
    s = argparse.SUPPRESS  # don't create defaults; handlers use getattr fallbacks
    g.add_argument("--config", metavar="FILE", default=s, help="YAML config file")
    g.add_argument("--token", default=s, help="Bearer auth token (overrides env)")
    g.add_argument("--iid", default=s, help="x-iid installation id (overrides env)")
    g.add_argument(
        "--language", choices=["uz-UZ", "ru-RU", "en-US"], default=s, help="content language"
    )
    g.add_argument("--output-dir", default=s, help="where to write JSON/CSV output")
    g.add_argument(
        "--format", choices=["json", "csv", "both"], default=s, help="output format (default: both)"
    )
    g.add_argument("--min-delay", type=float, default=s, help="min seconds between requests")
    g.add_argument("--jitter", type=float, default=s, help="random extra delay 0..N seconds")
    g.add_argument("--max-retries", type=int, default=s, help="retries on transient failures")
    g.add_argument("--timeout", type=float, default=s, help="per-request timeout seconds")
    g.add_argument(
        "-v", "--verbose", action="count", default=s, help="-v debug, -vv wire logs"
    )
    return parent


def _add_catalog_flags(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--sort",
        choices=sorted(queries.SORT_CHOICES),
        default="relevance",
        help="ordering (orders = best-selling)",
    )
    p.add_argument("--max", dest="max_products", type=int, default=None, help="cap products")
    p.add_argument("--with-details", action="store_true", help="also fetch full product pages")
    p.add_argument("--with-reviews", action="store_true", help="also fetch reviews per product")
    p.add_argument("--max-reviews", type=int, default=200, help="cap reviews per product")
    p.add_argument("--show-adult", action="store_true", help="include adult-content items")


# ---------------------------------------------------------------------------
# config wiring
# ---------------------------------------------------------------------------


def _config_from_args(args: argparse.Namespace) -> Config:
    overrides = {
        "auth_token": getattr(args, "token", None),
        "iid": getattr(args, "iid", None),
        "language": getattr(args, "language", None),
        "output_dir": getattr(args, "output_dir", None),
        "min_delay": getattr(args, "min_delay", None),
        "jitter": getattr(args, "jitter", None),
        "max_retries": getattr(args, "max_retries", None),
        "timeout": getattr(args, "timeout", None),
    }
    return Config.load(config_path=getattr(args, "config", None), overrides=overrides)


def _formats(args: argparse.Namespace) -> tuple[str, ...]:
    choice = getattr(args, "format", "both")
    return ("json", "csv") if choice == "both" else (choice,)


# ---------------------------------------------------------------------------
# command handlers
# ---------------------------------------------------------------------------


def cmd_doctor(args: argparse.Namespace) -> int:
    cfg = _config_from_args(args)
    print("Configuration (token masked):")
    for key, val in cfg.redacted().items():
        print(f"  {key:12} = {val}")
    print()

    ok = True
    for label, url in (("GraphQL", cfg.graphql_url), ("REST", cfg.rest_base)):
        status = _probe(url, cfg)
        reachable = status is not None
        note = _status_note(status)
        print(f"  {label:8} {url}  ->  {note}")
        ok = ok and reachable

    print()
    if not cfg.has_token:
        print("⚠  No auth token configured. Most endpoints need one.")
        print("   1. Open https://uzum.uz, DevTools → Network → filter 'graphql'.")
        print("   2. Right-click a request → Copy → Copy as cURL, save to curl.txt.")
        print("   3. Run:  uzum-scraper auth --from-curl-file curl.txt")
        return 0 if ok else 2

    print("Token present — trying a live category fetch…")
    try:
        with UzumClient(cfg) as client:
            roots = client.get_categories()
        print(f"✓  Auth works. Fetched {len(roots)} root categories.")
        return 0
    except UzumError as exc:
        print(f"✗  Live call failed: {exc}")
        print("   If this is a 401/redirect, your token likely expired — re-import it.")
        return 2


def cmd_auth(args: argparse.Namespace) -> int:
    if args.from_curl_file:
        command = Path(args.from_curl_file).read_text(encoding="utf-8")
    else:
        command = args.from_curl
    imported = parse_curl(command)
    if not imported.ok:
        log.error("No Authorization header found in the cURL command.")
        log.error("Make sure you copied a request to graphql.uzum.uz (it carries the token).")
        return 2

    updates = {"UZUM_AUTH_TOKEN": imported.auth_token}
    if imported.iid:
        updates["UZUM_IID"] = imported.iid
    if imported.language:
        updates["UZUM_LANGUAGE"] = imported.language

    _update_env_file(args.env_file, updates)
    masked = f"***{imported.auth_token[-4:]}" if len(imported.auth_token) > 4 else "***"
    print(f"✓  Wrote token ({masked}) to {args.env_file}")
    if imported.iid:
        print(f"   x-iid    = {imported.iid}")
    if imported.language:
        print(f"   language = {imported.language}")
    print("   Try:  uzum-scraper doctor")
    return 0


def cmd_categories(args: argparse.Namespace) -> int:
    cfg = _config_from_args(args)
    with UzumClient(cfg) as client:
        result = pipeline.scrape_categories(client, cfg, formats=_formats(args))
    print(result.summary())
    return 0


def cmd_category(args: argparse.Namespace) -> int:
    cfg = _config_from_args(args)
    with UzumClient(cfg) as client:
        result = pipeline.scrape_category(
            client,
            cfg,
            args.category_id,
            sort=queries.SORT_CHOICES[args.sort],
            max_products=args.max_products,
            with_details=args.with_details,
            with_reviews=args.with_reviews,
            max_reviews=args.max_reviews,
            formats=_formats(args),
            show_adult=args.show_adult,
        )
    print(result.summary())
    return 0


def cmd_search(args: argparse.Namespace) -> int:
    cfg = _config_from_args(args)
    with UzumClient(cfg) as client:
        result = pipeline.scrape_search(
            client,
            cfg,
            args.text,
            category_id=getattr(args, "category_id", None),
            sort=queries.SORT_CHOICES[args.sort],
            max_products=args.max_products,
            with_details=args.with_details,
            with_reviews=args.with_reviews,
            max_reviews=args.max_reviews,
            formats=_formats(args),
            show_adult=args.show_adult,
        )
    print(result.summary())
    return 0


def cmd_shop(args: argparse.Namespace) -> int:
    cfg = _config_from_args(args)
    with UzumClient(cfg) as client:
        result = pipeline.scrape_shop(
            client,
            cfg,
            args.shop_name,
            shop_id=getattr(args, "shop_id", None),
            sort=queries.SORT_CHOICES[args.sort],
            max_products=args.max_products,
            with_details=args.with_details,
            with_reviews=args.with_reviews,
            max_reviews=args.max_reviews,
            formats=_formats(args),
        )
    print(result.summary())
    return 0


def cmd_product(args: argparse.Namespace) -> int:
    cfg = _config_from_args(args)
    with UzumClient(cfg) as client:
        result = pipeline.scrape_product(
            client,
            cfg,
            args.product_id,
            with_reviews=not args.no_reviews,
            max_reviews=args.max_reviews,
            formats=_formats(args),
        )
    print(result.summary())
    return 0


def cmd_reviews(args: argparse.Namespace) -> int:
    cfg = _config_from_args(args)
    with UzumClient(cfg) as client:
        result = pipeline.scrape_product(
            client,
            cfg,
            args.product_id,
            with_reviews=True,
            max_reviews=args.max_reviews,
            formats=_formats(args),
        )
    print(result.summary())
    return 0


_HANDLERS = {
    "doctor": cmd_doctor,
    "auth": cmd_auth,
    "categories": cmd_categories,
    "category": cmd_category,
    "search": cmd_search,
    "shop": cmd_shop,
    "product": cmd_product,
    "reviews": cmd_reviews,
}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _probe(url: str, cfg: Config) -> int | None:
    """Return the HTTP status of a quick probe, or None if unreachable."""
    try:
        resp = httpx.get(url, timeout=min(cfg.timeout, 15), follow_redirects=False)
        return resp.status_code
    except httpx.HTTPError:
        return None


def _status_note(status: int | None) -> str:
    if status is None:
        return "unreachable (network/proxy blocked)"
    if status in (401, 403):
        return f"reachable (HTTP {status}: needs a token — expected)"
    if status in (400,):
        return f"reachable (HTTP {status}: needs params/token — expected)"
    return f"reachable (HTTP {status})"


def _update_env_file(path: str, updates: dict[str, str]) -> None:
    p = Path(path)
    lines: list[str] = []
    seen: set[str] = set()
    if p.is_file():
        for line in p.read_text(encoding="utf-8").splitlines():
            key = line.split("=", 1)[0].strip()
            if key in updates:
                lines.append(f"{key}={updates[key]}")
                seen.add(key)
            else:
                lines.append(line)
    for key, val in updates.items():
        if key not in seen:
            lines.append(f"{key}={val}")
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# entry point
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    setup_logging(getattr(args, "verbose", 0))
    handler = _HANDLERS[args.command]
    try:
        return handler(args)
    except ConfigError as exc:
        log.error("Configuration error: %s", exc)
        return 2
    except UzumError as exc:
        log.error("%s", exc)
        return 1
    except KeyboardInterrupt:  # pragma: no cover
        log.warning("Interrupted.")
        return 130


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
