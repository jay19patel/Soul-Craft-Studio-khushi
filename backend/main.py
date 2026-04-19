"""
* main.py
? E-commerce application: catalog, carts, checkout, and content APIs built on Backbone.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from backbone import scheduler, setup_backbone, signals
from backbone.config import settings
from backbone.services.mail import mail_service
from ecommerce import ECOMMERCE_DOCUMENT_MODELS
from ecommerce.api.content import content_router
from ecommerce.api.shop import shop_router
from ecommerce.models import Order, Product

logger = logging.getLogger("ecommerce")


# ── Order lifecycle email hooks ─────────────────────────────────────────────
# ? These handlers wire into Backbone's signal system (AuditDocument emits them
#   on every insert/save). No backbone internals are modified.


@signals.post_create.connect(Order)
async def send_order_confirmation_on_create(instance: Order, **kwargs: Any) -> None:
    """Send a receipt email immediately after an order is inserted."""
    try:
        await mail_service.send_order_confirmation_email(
            to_email=instance.customer_email,
            order=instance,
        )
    except Exception as exc:
        logger.error(
            "Order confirmation email failed for order %s: %s", instance.id, exc
        )


@signals.post_update.connect(Order)
async def send_status_email_on_order_status_change(
    instance: Order, changed_fields: dict | None = None, **kwargs: Any
) -> None:
    """Send a status-change email only when the ``status`` field actually changed."""
    if not changed_fields or "status" not in changed_fields:
        return
    new_status = str(instance.status)
    try:
        await mail_service.send_order_status_update_email(
            to_email=instance.customer_email,
            order=instance,
            new_status=new_status,
        )
    except Exception as exc:
        logger.error(
            "Order status update email failed for order %s (→ %s): %s",
            instance.id,
            new_status,
            exc,
        )


# ── Scheduled jobs ─────────────────────────────────────────────────────────


@scheduler.interval(hours=24)
async def daily_store_housekeeping_job() -> None:
    """Placeholder for nightly jobs (e.g. stale guest carts, analytics)."""
    logger.info("E-commerce: daily housekeeping tick.")


# ── FastAPI application ─────────────────────────────────────────────────────

app = FastAPI(
    title="Backbone E-Commerce Demo",
    description="Storefront APIs (shop + content) on Backbone + Beanie + MongoDB.",
    version="1.0.0",
)

setup_backbone(app, models=[*ECOMMERCE_DOCUMENT_MODELS])

app.include_router(shop_router, prefix="/api/shop")
app.include_router(content_router, prefix="/api")

_storefront_templates = Jinja2Templates(directory=str(settings.user_templates_path))


@app.get("/store", response_class=HTMLResponse, tags=["Storefront"])
async def ecommerce_storefront_page(request: Request) -> HTMLResponse:
    """HTML catalog + guest cart + checkout; uses JSON under ``/api/shop``."""
    return _storefront_templates.TemplateResponse(
        request=request,
        name="pages/store/index.html",
        context={
            "page_name": "Store",
            "api_base": str(request.base_url).rstrip("/"),
        },
    )


@app.get("/")
async def root() -> dict[str, object]:
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "admin": f"{settings.ADMIN_PREFIX}/",
        "user_guide": "/pages/user-guide",
        "api": {
            "auth": "/api/auth",
            "shop": "/api/shop",
            "content_faqs": "/api/faqs",
            "content_contact": "/api/content/contact",
            "storefront": "/store",
        },
    }
