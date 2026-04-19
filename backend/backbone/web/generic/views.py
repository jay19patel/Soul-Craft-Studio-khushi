"""
* backbone/web/generic/views.py
? Ready-to-use Generic View classes that combine mixins into FastAPI routers.

Usage::

    class ProductView(GenericCrudView):
        model = Product
        search_fields = ["name", "description"]
        filter_fields = ["category", "status", "price"]
        fetch_links = True

    app.include_router(ProductView.as_router(prefix="/api/products", tags=["Products"]))

Slug-based lookup::

    class ArticleView(GenericCrudView):
        model = Article
        lookup_field = "slug"   # GET /api/articles/my-article-slug

Permission control::

    class ProtectedView(GenericCrudView):
        model = Order
        permission_classes = [IsAuthenticated]
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from enum import Enum
from typing import Any, cast

from fastapi import APIRouter, Body, Depends, Query, Request, Response, status

from backbone.web.generic.mixins import (
    CreateMixin,
    DeleteMixin,
    ListMixin,
    RetrieveMixin,
    UpdateMixin,
)

logger = logging.getLogger("backbone.web.generic.views")


def _parse_sort_param(sort_value: str | None) -> str | None:
    """
    Pass through sort strings.
    Beanie supports '-field' for descending, 'field' for ascending.
    """
    return sort_value or None


class GenericListView(ListMixin):
    """Read-only view exposing a paginated, searchable list endpoint."""

    @classmethod
    def as_router(cls, prefix: str, tags: list[str] | None = None, **kwargs: Any) -> APIRouter:
        view = cls()
        router = APIRouter(
            prefix=prefix,
            tags=cast(list[str | Enum], list(tags or [prefix.strip("/")])),
            **kwargs,
        )
        permission_dep = view.get_permission_dependency()

        @router.get("/", summary=f"List {view.model.__name__}")
        async def list_handler(
            request: Request,
            user: Any = Depends(permission_dep),
            page: int = Query(1, ge=1, description="Page number"),
            page_size: int = Query(10, ge=1, le=200, description="Items per page"),
            search: str | None = Query(None, description="Full-text search"),
            sort: str | None = Query(None, description="Sort field, prefix - for descending"),
        ) -> dict[str, Any]:
            base_query = await view.get_queryset(request, user)
            filtered_query = await view.filter_queryset(base_query, request)
            results, total = await view.perform_list(
                filtered_query,
                skip=(page - 1) * page_size,
                limit=page_size,
                sort=_parse_sort_param(sort),
            )
            return view.format_list_response(results, total, page, page_size)

        return router


class GenericCreateView(CreateMixin):
    """Write-only view exposing a single create endpoint."""

    @classmethod
    def as_router(cls, prefix: str, tags: list[str] | None = None, **kwargs: Any) -> APIRouter:
        view = cls()
        router = APIRouter(
            prefix=prefix,
            tags=cast(list[str | Enum], list(tags or [prefix.strip("/")])),
            **kwargs,
        )
        permission_dep = view.get_permission_dependency()

        @router.post("/", summary=f"Create {view.model.__name__}", status_code=201)
        async def create_handler(
            request: Request,
            data: dict[str, Any] = Body(...),
            user: Any = Depends(permission_dep),
        ) -> Any:
            enriched_data = _inject_audit_fields_on_create(data, user, view.model)
            prepared_data = await view.before_create(enriched_data, user)
            instance = await view.perform_create(prepared_data)
            return await view.after_create(instance, user)

        return router


class GenericRetrieveView(RetrieveMixin):
    """Read-only view exposing a single-object detail endpoint."""

    @classmethod
    def as_router(cls, prefix: str, tags: list[str] | None = None, **kwargs: Any) -> APIRouter:
        view = cls()
        router = APIRouter(
            prefix=prefix,
            tags=cast(list[str | Enum], list(tags or [prefix.strip("/")])),
            **kwargs,
        )
        permission_dep = view.get_permission_dependency()

        @router.get(f"/{{{view.lookup_field}}}", summary=f"Retrieve {view.model.__name__}")
        async def retrieve_handler(
            request: Request,
            user: Any = Depends(permission_dep),
        ) -> Any:
            lookup_value = request.path_params.get(view.lookup_field, "")
            return await view.perform_retrieve(lookup_value, request, user)

        return router


class GenericCrudView(ListMixin, CreateMixin, RetrieveMixin, UpdateMixin, DeleteMixin):
    """
    Full CRUD view combining all mixins.

    Generates these routes:
        GET    /           → list (paginated, filterable)
        POST   /           → create
        GET    /{lookup}   → retrieve by id or slug
        PATCH  /{lookup}   → partial update
        DELETE /{lookup}   → soft delete (204)
    """

    @classmethod
    def as_router(cls, prefix: str, tags: list[str] | None = None, **kwargs: Any) -> APIRouter:
        view = cls()
        router = APIRouter(
            prefix=prefix,
            tags=cast(list[str | Enum], list(tags or [prefix.strip("/")])),
            **kwargs,
        )
        permission_dep = view.get_permission_dependency()
        lookup_param = view.lookup_field

        # ── List ───────────────────────────────────────────────────────────

        @router.get("/", summary=f"List {view.model.__name__}")
        async def list_handler(
            request: Request,
            user: Any = Depends(permission_dep),
            page: int = Query(1, ge=1),
            page_size: int = Query(10, ge=1, le=200),
            search: str | None = Query(None),
            sort: str | None = Query(None),
        ) -> dict[str, Any]:
            base_query = await view.get_queryset(request, user)
            filtered_query = await view.filter_queryset(base_query, request)
            results, total = await view.perform_list(
                filtered_query,
                skip=(page - 1) * page_size,
                limit=page_size,
                sort=_parse_sort_param(sort),
            )
            return view.format_list_response(results, total, page, page_size)

        # ── Create ─────────────────────────────────────────────────────────

        @router.post("/", summary=f"Create {view.model.__name__}", status_code=201)
        async def create_handler(
            request: Request,
            data: dict[str, Any] = Body(...),
            user: Any = Depends(permission_dep),
        ) -> Any:
            enriched_data = _inject_audit_fields_on_create(data, user, view.model)
            prepared_data = await view.before_create(enriched_data, user)
            instance = await view.perform_create(prepared_data)
            return await view.after_create(instance, user)

        # ── Retrieve ───────────────────────────────────────────────────────

        @router.get(f"/{{{lookup_param}}}", summary=f"Retrieve {view.model.__name__}")
        async def retrieve_handler(
            request: Request,
            user: Any = Depends(permission_dep),
        ) -> Any:
            lookup_value = request.path_params.get(lookup_param, "")
            return await view.perform_retrieve(lookup_value, request, user)

        # ── Update (PATCH) ─────────────────────────────────────────────────

        @router.patch(f"/{{{lookup_param}}}", summary=f"Update {view.model.__name__}")
        async def update_handler(
            request: Request,
            user: Any = Depends(permission_dep),
            data: dict[str, Any] = Body(default_factory=dict),
        ) -> Any:
            lookup_value = request.path_params.get(lookup_param, "")
            instance = await view.get_object_by_lookup(lookup_value, request, user)
            update_data = await view.before_update(instance, data, user)
            updated = await view.perform_update(instance, update_data)
            return await view.after_update(updated, user)

        # ── Delete ─────────────────────────────────────────────────────────

        @router.delete(
            f"/{{{lookup_param}}}",
            summary=f"Delete {view.model.__name__}",
            status_code=status.HTTP_204_NO_CONTENT,
            response_class=Response,
        )
        async def delete_handler(
            request: Request,
            user: Any = Depends(permission_dep),
        ) -> Response:
            lookup_value = request.path_params.get(lookup_param, "")
            instance = await view.get_object_by_lookup(lookup_value, request, user)
            await view.perform_delete(instance, user)
            return Response(status_code=status.HTTP_204_NO_CONTENT)

        return router


# ── Helpers ────────────────────────────────────────────────────────────────


def _inject_audit_fields_on_create(
    data: dict[str, Any],
    user: Any,
    model: Any,
) -> dict[str, Any]:
    """
    Inject created_at and created_by audit fields when the model supports them.
    Only sets values that are not already present in the incoming data.
    """
    result = dict(data)

    if hasattr(model, "created_at") and "created_at" not in result:
        result["created_at"] = datetime.now(UTC)

    if user and hasattr(model, "created_by") and "created_by" not in result:
        result["created_by"] = str(getattr(user, "id", user))

    return result
