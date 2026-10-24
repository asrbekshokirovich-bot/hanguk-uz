"""uzum-market-scraper — collect catalog data from Uzum Market (uzum.uz).

Public API:

    from uzum_scraper import UzumClient, Config

    cfg = Config.load()
    with UzumClient(cfg) as client:
        for product in client.iter_category_products(category_id=10020):
            print(product.title, product.orders_quantity)
"""

from .client import UzumClient
from .config import Config
from .errors import (
    AuthError,
    ConfigError,
    NotFoundError,
    RateLimitedError,
    UzumError,
    UzumHTTPError,
)
from .models import CatalogProduct, Category, ProductDetail, Review, Shop

__all__ = [
    "UzumClient",
    "Config",
    "UzumError",
    "ConfigError",
    "AuthError",
    "NotFoundError",
    "RateLimitedError",
    "UzumHTTPError",
    "Category",
    "CatalogProduct",
    "ProductDetail",
    "Review",
    "Shop",
]

__version__ = "0.1.0"
