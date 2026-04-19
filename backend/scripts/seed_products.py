#!/usr/bin/env python3
"""
Seed 10 demo catalog products (MongoDB / Beanie).

Run from the ``backend`` directory::

    uv run python scripts/seed_products.py

Uses the same ``MONGODB_URL`` / ``DATABASE_NAME`` as ``main.py`` (via ``.env``).
Skips a product if one with the same name already exists.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import TYPE_CHECKING, Any

from beanie import Document

if TYPE_CHECKING:
    from ecommerce.models import Product

logger = logging.getLogger("ecommerce.seed_products")

# ? Public HTTPS image — downloaded into ``MEDIA_ROOT`` and linked like Admin “URL” upload.
SEED_PRIMARY_IMAGE_URL = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"

DEMO_PRODUCTS: list[tuple[str, str, float, str | None]] = [
    ("Handcrafted Ceramic Mug", "₹449", 449.0, "Kitchen"),
    ("Linen Throw Pillow — Indigo", "₹899", 899.0, "Home"),
    ("Brass Desk Lamp", "₹2,499", 2499.0, "Lighting"),
    ("Walnut Cutting Board", "₹1,299", 1299.0, "Kitchen"),
    ("Scented Soy Candle Set", "₹649", 649.0, "Wellness"),
    ("Woven Storage Basket", "₹1,099", 1099.0, "Home"),
    ("Stoneware Dinner Plate (set of 4)", "₹1,799", 1799.0, "Kitchen"),
    ("Cotton Table Runner", "₹549", 549.0, "Home"),
    ("Artisan Soap Trio", "₹399", 399.0, "Wellness"),
    ("Teak Serving Tray", "₹1,449", 1449.0, "Kitchen"),
]


def _slug_fragment(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:48] or "product"


async def _ensure_primary_image_from_public_url(product: "Product", image_url: str) -> None:
    """
    Download ``image_url`` to local media (same path as admin URL upload) and set ``product.primary_image``.
    No-op if ``primary_image`` is already set.
    """
    if product.primary_image is not None:
        logger.info("Product %r already has primary_image; skip URL download.", product.name)
        return

    from backbone.domain.models import Attachment
    from backbone.web.routers.admin.helpers import (
        build_beanie_link_from_object_id_string,
        download_https_url_and_save_as_attachment,
    )

    try:
        attachment_id = await download_https_url_and_save_as_attachment(image_url)
        link = build_beanie_link_from_object_id_string(Attachment, attachment_id)
        product.primary_image = link
        await product.save()
        logger.info(
            "Downloaded seed image from URL and linked primary_image for %r (attachment %s).",
            product.name,
            attachment_id,
        )
    except ValueError as exc:
        logger.warning("Seed image URL rejected (%s): %s", image_url, exc)
    except OSError as exc:
        logger.warning("Could not write seed image to media root: %s", exc)
    except Exception as exc:
        logger.warning("Seed image download/link failed for %r: %s", product.name, exc, exc_info=True)


async def _run() -> None:
    from backbone.core.database import close_database, init_database
    from backbone.domain.models import Attachment, Email, LogEntry, Session, Store, Task, User
    from ecommerce import ECOMMERCE_DOCUMENT_MODELS
    from ecommerce.models import Category, Product

    logging.basicConfig(level=logging.INFO)

    core_models: list[type[Document]] = [
        User,
        Session,
        LogEntry,
        Attachment,
        Store,
        Task,
        Email,
    ]
    extra_models = [m for m in ECOMMERCE_DOCUMENT_MODELS if m not in core_models]
    all_models: list[type[Document] | Any] = [*core_models, *extra_models]

    await init_database(all_models)

    category = await Category.find_one()
    if not category:
        category = Category(
            name="Shop Essentials",
            description="Seeded category for demo products",
        )
        await category.insert()
        logger.info("Created category: %s", category.name)

    category_id = str(category.id)
    created_count = 0

    for index, (name, price_label, price_value, tag) in enumerate(DEMO_PRODUCTS):
        existing = await Product.find_one(Product.name == name)
        if existing:
            logger.info("Skip (exists): %s", name)
            continue

        product = Product(
            name=name,
            slug=f"seed-{_slug_fragment(name)}-{index}",
            price=price_label,
            price_value=price_value,
            category_id=category_id,
            stock=25,
            description=f"Demo listing — {name}. Attach images from Admin → Product.",
            details="",
            is_published=True,
            tag=tag,
            primary_image=None,
            gallery_images=[],
        )
        await product.insert()
        created_count += 1
        logger.info("Inserted product: %s", name)

    first_demo_name = DEMO_PRODUCTS[0][0]
    hero_product = await Product.find_one(Product.name == first_demo_name)
    if hero_product:
        await _ensure_primary_image_from_public_url(hero_product, SEED_PRIMARY_IMAGE_URL)
    else:
        logger.warning("First demo product %r not found; cannot attach URL image.", first_demo_name)

    await close_database()
    logger.info("Done. Created %d new product(s).", created_count)


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
