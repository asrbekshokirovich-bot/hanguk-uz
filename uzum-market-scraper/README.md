# uzum-market-scraper

Collect catalog data from **[Uzum Market](https://uzum.uz)** (uzum.uz) — Uzbekistan's
largest online marketplace — as clean **JSON and CSV**.

It scrapes:

- 🗂️ **Categories** — the full category / subcategory tree (works with no token)
- 📦 **Products by category, search, or shop** — title, price, rating, review count,
  and **units sold** (`ordersQuantity`) per product
- 🔎 **Full product details** — description, characteristics, images, SKUs, seller
- ⭐ **Ratings & reviews** — per-product review text, stars, author, dates
- 🏪 **Shops/sellers** — profile plus **store-level sale count** (`ordersAmount`), rating,
  product count

It talks to Uzum's own REST (`api.uzum.uz`) and GraphQL (`graphql.uzum.uz`) endpoints —
the same ones the website uses — and is a **polite** client by default: a configurable
delay + jitter between requests, exponential-backoff retries, and `Retry-After` handling.

> **Unofficial.** This project is not affiliated with or endorsed by Uzum. It uses
> undocumented endpoints that can change without notice. Scrape responsibly, respect
> Uzum's Terms of Service and `robots.txt`, keep request rates low, and only use the data
> in ways permitted by law. See [Responsible use](#responsible-use).

---

## Install

```bash
git clone https://github.com/asrbekshokirovich-bot/uzum-market-scraper.git
cd uzum-market-scraper
python -m venv .venv && source .venv/bin/activate
pip install -e .            # or: pip install -r requirements.txt
```

Python 3.9+.

---

## Quick start

The category tree needs **no token**:

```bash
uzum-scraper categories
# -> data/2026-07-27_..._categories/{categories.json, categories.csv, categories.tree.json}
```

Everything else (product listings, details, reviews, shops) needs a short-lived token
from your browser — see [Getting a token](#getting-a-token):

```bash
# import a token once (see below), then:
uzum-scraper category 10020 --sort orders --max 500     # best-selling in a category
uzum-scraper search "iphone 15" --max 200               # search results
uzum-scraper shop "elektronika-plus"                    # a shop + its catalog
uzum-scraper product 720033                             # one product + its reviews
uzum-scraper reviews 720033 --max 1000                  # just the reviews
```

Check your setup any time:

```bash
uzum-scraper doctor
```

---

## Getting a token

Uzum's catalog endpoints sit behind an auth gateway. The web app uses a short-lived
**Bearer token** plus an **installation id** (`x-iid`). The tokens expire (typically within
an hour), so you grab a fresh one from your browser when needed:

1. Open <https://uzum.uz> in a desktop browser and browse any category.
2. Open **DevTools → Network** and filter by `graphql`.
3. Click any request to `graphql.uzum.uz` → **Request Headers**.
4. Copy the `authorization` value (the part after `Bearer `) and the `x-iid` value.

Then either put them in a `.env` file:

```bash
cp .env.example .env
# edit .env: UZUM_AUTH_TOKEN=...  UZUM_IID=...
```

…or, much easier, right-click that request → **Copy → Copy as cURL**, save it to a file,
and let the scraper extract everything for you:

```bash
uzum-scraper auth --from-curl-file curl.txt
# ✓ Wrote token (***abcd) to .env  (+ x-iid, language)
```

When requests start returning `401`/redirects, the token expired — grab a new one and
re-import.

### What needs a token?

| Data                                   | Endpoint             | Token required?          |
|----------------------------------------|----------------------|--------------------------|
| Category tree (`categories`)           | REST                 | ❌ no                     |
| Product listings (`category`,`search`,`shop`) | GraphQL       | ✅ yes                    |
| Product details (`product`)            | REST v2              | ✅ yes                    |
| Reviews (`reviews`, `product`)         | REST                 | ✅ yes                    |
| Shop profile (`shop`)                  | REST                 | ✅ yes                    |

---

## Commands

Run `uzum-scraper <command> --help` for full options. Global flags (`--token`, `--iid`,
`--language`, `--output-dir`, `--format`, `--min-delay`, `--jitter`, `-v`) work in any
position.

| Command | What it does |
|---|---|
| `doctor` | Check connectivity & auth; print guidance. |
| `auth --from-curl-file FILE` | Extract token/iid/language from a browser "Copy as cURL". |
| `categories` | Scrape the full category tree (nested JSON + flat CSV). |
| `category <id>` | Products in a category. `--sort`, `--max`, `--with-details`, `--with-reviews`. |
| `search <text>` | Products matching a query. `--category <id>`, `--sort`, `--max`. |
| `shop <slug>` | A shop's profile + catalog. `--shop-id`, `--with-details`. |
| `product <id>` | One product's full details + reviews. `--no-reviews`, `--max-reviews`. |
| `reviews <id>` | Only the reviews of a product. `--max`. |

**Sort options** (`--sort`): `relevance` (default), `orders` (best-selling), `newest`,
`price_asc`, `price_desc`, `rating`, `reviews`.

**Enrichment**: on `category`/`search`/`shop`, add `--with-details` to also fetch each
product's full page, and `--with-reviews` to also fetch reviews for every product (slow —
respect rate limits; cap with `--max` and `--max-reviews`).

### Examples

```bash
# Top 300 best-selling products in a category, with full details:
uzum-scraper category 10020 --sort orders --max 300 --with-details

# Search, restricted to a category, Russian language, to a custom folder:
uzum-scraper --language ru-RU --output-dir ./out search "airpods" --category 10020 --max 100

# A shop and everything it sells (incl. per-product sale counts):
uzum-scraper shop "some-shop-slug" --max 1000

# One product, JSON only:
uzum-scraper --format json product 720033
```

---

## Output

Each run writes a timestamped folder under `--output-dir` (default `./data`):

```
data/2026-07-27_153610_category-10020/
├── products.json          # parsed rows (see fields below)
├── products.csv           # same, flat CSV
├── product_details.json   # if --with-details
├── reviews.json           # if --with-reviews
└── manifest.json          # what ran, when, config (token masked), row counts
```

Key product fields: `product_id`, `title`, `sell_price`, `full_price`, `rating`,
**`orders_quantity`** (units sold), `reviews_quantity`, `url`, `image`, plus
`source_type`/`source_value` (how it was found). Prices are in Uzbekistani so'm, exactly as
returned by the API.

`--format` selects `json`, `csv`, or `both` (default).

---

## Library usage

```python
from uzum_scraper import UzumClient, Config

cfg = Config.load()                       # reads .env / env vars
with UzumClient(cfg) as client:
    # Category tree (no token needed)
    for cat in client.iter_categories():
        print(cat.id, cat.path, cat.product_amount)

    # Best-selling products in a category
    for p in client.iter_category_products(10020, sort="BY_ORDERS_QUANTITY_DESC", max_items=100):
        print(p.title, p.sell_price, "sold:", p.orders_quantity)

    # Full details + reviews
    detail = client.get_product(720033)
    for review in client.iter_reviews(720033, max_items=200):
        print(review.rating, review.author, review.text[:60])
```

See [`examples/basic_usage.py`](examples/basic_usage.py).

---

## Configuration

Precedence (highest first): **CLI flag → `--config` YAML → environment / `.env` → default**.

| Setting | Env var | Default | Notes |
|---|---|---|---|
| Auth token | `UZUM_AUTH_TOKEN` | — | Bearer token (without `Bearer `). |
| Installation id | `UZUM_IID` | auto | Random UUID, cached in `~/.config/uzum-scraper/iid`. |
| Language | `UZUM_LANGUAGE` | `uz-UZ` | `uz-UZ`, `ru-RU`, `en-US`. |
| Min delay | `UZUM_MIN_DELAY` | `0.7` | Seconds between requests. |
| Jitter | `UZUM_JITTER` | `0.6` | Random extra 0..N seconds. |
| Max retries | `UZUM_MAX_RETRIES` | `5` | On 429/5xx/network errors. |
| Timeout | `UZUM_TIMEOUT` | `30` | Per-request seconds. |
| Output dir | `UZUM_OUTPUT_DIR` | `./data` | |

See [`.env.example`](.env.example) and [`config.example.yaml`](config.example.yaml).

---

## Responsible use

- This uses **undocumented** endpoints; they can break at any time.
- Keep `min_delay`/`jitter` reasonable — don't hammer the API. The defaults are polite;
  lower them only with good reason.
- Respect Uzum's Terms of Service and `robots.txt`. Don't collect personal data, and don't
  republish scraped content in ways that violate their terms or applicable law.
- For anything beyond light research, ask Uzum for proper API access.

---

## Development

```bash
pip install -e ".[dev]"
make test        # pytest (offline; uses mocked transport)
make lint        # ruff + mypy
make doctor      # live connectivity/auth check
```

The test suite runs fully offline via `httpx.MockTransport`, so it's safe and fast in CI.

## License

MIT — see [LICENSE](LICENSE).
