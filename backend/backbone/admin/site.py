"""
* backbone/admin/site.py
? Global admin registry. Models and custom pages are registered here
  and rendered by the admin router.
"""

import logging
from typing import Any, Optional

from beanie import Document

logger = logging.getLogger("backbone.admin.site")


class ModelAdmin:
    """
    Optional configuration for how a model is displayed in the admin panel.

    Usage::

        class ProductAdmin(ModelAdmin):
            list_display = ["name", "price", "status"]
            search_fields = ["name"]
            ordering = "-created_at"

        admin_site.register(Product, admin_class=ProductAdmin)
    """

    list_display: list[str] = []
    search_fields: list[str] = []
    ordering: str | None = None
    readonly_fields: list[str] = []


class AdminSite:
    """
    Singleton registry of Beanie models and custom admin pages.
    Used by the admin router to discover what models to manage.
    """

    _instance: Optional["AdminSite"] = None

    def __init__(self) -> None:
        self._model_registry: dict[str, dict[str, Any]] = {}
        self._page_registry: dict[str, dict[str, Any]] = {}

    @classmethod
    def get_instance(cls) -> "AdminSite":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ── Model Registration ─────────────────────────────────────────────────

    def register(
        self,
        model: type[Document],
        admin_class: type[ModelAdmin] = ModelAdmin,
        category: str = "Custom Models",
    ) -> None:
        """Register a Beanie Document for admin management."""
        model_name = model.__name__
        self._model_registry[model_name] = {
            "model": model,
            "admin": admin_class(),
            "name": model_name,
            "category": category,
        }
        logger.debug("Registered model '%s' in admin.", model_name)

    def unregister(self, model: type[Document]) -> None:
        self._model_registry.pop(model.__name__, None)

    def get_all_registered_models(self) -> list[dict[str, Any]]:
        return list(self._model_registry.values())

    def get_registered_models(self) -> list[dict[str, Any]]:
        """Alias for templates and older code — same as get_all_registered_models()."""
        return self.get_all_registered_models()

    def get_model_config(self, model_name: str) -> dict[str, Any] | None:
        return self._model_registry.get(model_name)

    def is_model_registered(self, model_name: str) -> bool:
        return model_name in self._model_registry

    # ── Page Registration ──────────────────────────────────────────────────

    def register_page(
        self,
        *,
        name: str,
        path: str,
        methods: list[str],
        description: str = "",
        category: str = "Framework Pages",
    ) -> None:
        """Register a custom HTML page to appear in the admin navigation."""
        self._page_registry[name] = {
            "name": name,
            "path": path,
            "methods": methods,
            "description": description,
            "category": category,
        }

    def get_all_registered_pages(self) -> list[dict[str, Any]]:
        return list(self._page_registry.values())

    def get_registered_pages(self) -> list[dict[str, Any]]:
        """Alias for templates and older code — same as get_all_registered_pages()."""
        return self.get_all_registered_pages()


# ? Global singleton — importable directly:  from backbone.admin import admin_site
admin_site = AdminSite.get_instance()
