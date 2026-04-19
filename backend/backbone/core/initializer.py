"""
* backbone/core/initializer.py
? Application bootstrap: wires middleware, routes, database, admin,
  scheduler, and the startup/shutdown lifecycle.

  Call setup_backbone(app, models=[MyModel]) once in your main.py.
"""

import logging
from typing import Any, cast

from beanie import Document
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backbone.admin.site import admin_site
from backbone.config import BackboneSettings
from backbone.config import settings as default_settings
from backbone.core.database import close_database, init_database
from backbone.core.exceptions import register_exception_handlers

logger = logging.getLogger("backbone.core.initializer")


def setup_backbone(
    app: FastAPI,
    models: list[Any] | None = None,
    app_settings: BackboneSettings | None = None,
) -> None:
    """
    Wire all Backbone features onto a FastAPI application.

    Call this once in your main.py *after* creating the FastAPI instance:

        app = FastAPI()
        setup_backbone(app, models=[Product, Order])

    Args:
        app:          Your FastAPI instance.
        models:       List of additional Beanie Document classes to register.
        app_settings: Optional settings override (defaults to global singleton).
    """
    resolved_settings = app_settings or default_settings
    extra_models = models or []

    _configure_cors_middleware(app, resolved_settings)
    _configure_exception_handlers(app)
    _register_admin_models(extra_models, resolved_settings)
    _mount_routes(app, resolved_settings)
    _mount_media_static_files(app, resolved_settings)
    _attach_lifespan_handlers(app, extra_models, resolved_settings)

    logger.info(
        "Backbone initialized for '%s' (%s environment).",
        resolved_settings.APP_NAME,
        resolved_settings.ENVIRONMENT,
    )


# ── Middleware ─────────────────────────────────────────────────────────────


def _configure_cors_middleware(app: FastAPI, resolved_settings: BackboneSettings) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.debug("CORS configured: %s", resolved_settings.cors_origins_list)


# ── Exception Handlers ─────────────────────────────────────────────────────


def _configure_exception_handlers(app: FastAPI) -> None:
    register_exception_handlers(app)


# ── Route Mounting ─────────────────────────────────────────────────────────


def _mount_routes(app: FastAPI, resolved_settings: BackboneSettings) -> None:
    from backbone.web.routers.admin.media_upload import router as admin_media_router
    from backbone.web.routers.admin.views import router as admin_router
    from backbone.web.routers.auth import router as auth_router
    from backbone.web.routers.pages import register_framework_pages_in_admin_sidebar
    from backbone.web.routers.pages import router as pages_router

    register_framework_pages_in_admin_sidebar()

    app.include_router(auth_router, prefix="/api")
    app.include_router(admin_media_router, prefix="/api")
    app.include_router(admin_router)
    app.include_router(pages_router)
    logger.debug("Core routes mounted.")


def _mount_media_static_files(app: FastAPI, resolved_settings: BackboneSettings) -> None:
    media_directory = resolved_settings.media_root_path
    media_directory.mkdir(parents=True, exist_ok=True)
    app.mount(
        resolved_settings.MEDIA_URL_PREFIX,
        StaticFiles(directory=str(media_directory)),
        name="media",
    )
    logger.debug("Media files served from '%s'.", media_directory)


# ── Admin Registration ─────────────────────────────────────────────────────


def _register_admin_models(
    extra_models: list[Any],
    resolved_settings: BackboneSettings,
) -> None:
    from backbone.domain.models import Attachment, Email, LogEntry, Session, Store, Task, User

    core_document_models = [User, Session, LogEntry, Attachment, Store, Task, Email]

    admin_site.register(User, category="Core Models")
    admin_site.register(Session, category="Core Models")
    admin_site.register(LogEntry, category="Core Models")
    admin_site.register(Task, category="Core Models")
    admin_site.register(Email, category="Core Models")
    admin_site.register(Attachment, category="Core Models")
    admin_site.register(Store, category="Core Models")

    ecommerce_models = {
        "Category", "Product", "Cart", "CartItem", "Order", "OrderItem", "Payment", 
        "FAQ", "Testimonial", "Contact"
    }

    for user_model in extra_models:
        model_name = user_model.__name__
        if user_model not in core_document_models:
            if not admin_site.is_model_registered(model_name):
                category = "E-commerce" if model_name in ecommerce_models else "Other Models"
                admin_site.register(user_model, category=category)


# ── Lifecycle Handlers ─────────────────────────────────────────────────────


def _attach_lifespan_handlers(
    app: FastAPI,
    extra_models: list[Any],
    resolved_settings: BackboneSettings,
) -> None:
    """
    Attach startup + shutdown events.
    Uses the modern lifespan pattern if FastAPI supports it,
    falling back to on_event for older versions.
    """

    from backbone.domain.models import Attachment, Email, LogEntry, Session, Store, Task, User

    all_document_models = [User, Session, LogEntry, Attachment, Store, Task, Email]
    for user_model in extra_models:
        if user_model not in all_document_models:
            all_document_models.append(user_model)

    @app.on_event("startup")
    async def _backbone_startup() -> None:
        await init_database(
            cast(list[type[Document] | str | Any], all_document_models),
            app_settings=resolved_settings,
        )

        from backbone.services.auth import AuthService

        auth_service = AuthService(app_settings=resolved_settings)
        await auth_service.seed_admin_user(
            resolved_settings.ADMIN_EMAIL,
            resolved_settings.ADMIN_PASSWORD,
        )

        from backbone.services.scheduler import scheduler

        scheduler.start()

        logger.info("Backbone startup complete.")

    @app.on_event("shutdown")
    async def _backbone_shutdown() -> None:
        from backbone.services.scheduler import scheduler

        scheduler.stop()
        await close_database()
        logger.info("Backbone shutdown complete.")
