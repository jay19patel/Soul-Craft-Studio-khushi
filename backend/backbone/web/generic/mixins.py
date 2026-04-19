"""
* backbone/web/generic/mixins.py
? CRUD mixins for Backbone class-based views.

  Each mixin encapsulates one concern (List, Create, Retrieve, Update, Delete).
  They share a common ViewContext base that wires the repository and permissions.

  Advanced URL filtering supports operators via double-underscore notation:
    ?price__gt=100        → {"price": {"$gt": 100}}
    ?status__in=a,b       → {"status": {"$in": ["a","b"]}}
    ?name__contains=acme  → {"name": {"$regex": "acme", "$options": "i"}}
    ?name__startswith=ac  → {"name": {"$regex": "^ac", "$options": "i"}}
    ?slug=my-slug         → {"slug": "my-slug"}   (exact match via filter_fields)

  Lifecycle hooks (override in your view):
    get_queryset, filter_queryset, before_create, after_create,
    before_update, after_update, perform_delete
"""

from __future__ import annotations

import logging
import re
from collections.abc import Callable
from math import ceil
from typing import Any, ClassVar

from beanie import Document
from fastapi import Request
from pydantic import BaseModel

from backbone.repositories.base import BaseRepository, build_mongo_filter_from_operator
from backbone.web.permissions.base import AllowAny, PermissionDependency

logger = logging.getLogger("backbone.web.generic.mixins")

# ? Query params consumed by the pagination/search system — never treated as filters
_SYSTEM_QUERY_PARAMS = frozenset({"page", "page_size", "search", "sort", "skip", "limit"})

# ? Separator for operator lookup: ?price__gt=100  →  field="price", op="gt"
_OPERATOR_SEPARATOR = "__"


def _extract_field_and_operator(param_key: str) -> tuple[str, str | None]:
    """
    Split a query param key into (field_name, operator).
    Returns (field_name, None) for plain equality params.
    """
    if _OPERATOR_SEPARATOR in param_key:
        parts = param_key.split(_OPERATOR_SEPARATOR, 1)
        return parts[0], parts[1]
    return param_key, None


class ViewContext:
    """
    Shared state for all generic view mixins.
    Override class variables to configure behaviour.
    """

    model: ClassVar[type[Document]]
    repository_class: ClassVar[type[BaseRepository]] = BaseRepository
    permission_classes: ClassVar[list[type]] = [AllowAny]

    # ? Alternative lookup field for detail routes (e.g. "slug" instead of "id")
    lookup_field: ClassVar[str] = "id"

    # ? Pydantic models for request/response — optional but recommended
    response_schema: ClassVar[type[BaseModel] | None] = None
    create_schema: ClassVar[type[BaseModel] | None] = None
    update_schema: ClassVar[type[BaseModel] | None] = None

    # ? Fields scanned for full-text search (?search=query)
    search_fields: ClassVar[list[str]] = []

    # ? Fields exposed to exact/operator filtering in query params
    filter_fields: ClassVar[list[str]] = []

    # ? Whether to fetch linked (related) documents automatically
    fetch_links: ClassVar[bool] = False

    def __init__(self) -> None:
        self.repository = self.repository_class(self.model)

    def get_permission_dependency(self) -> Callable:
        return PermissionDependency(self.permission_classes)

    async def get_object_by_lookup(
        self, lookup_value: str, request: Request, user: Any
    ) -> Document:
        """
        Resolve an object by lookup_field value.
        Supports 'id' (MongoDB ObjectId) and any other field (e.g. slug).
        """
        if self.lookup_field == "id":
            obj = await self.repository.get(lookup_value, fetch_links=self.fetch_links)
        else:
            obj = await self.repository.get_by_field(
                self.lookup_field, lookup_value, fetch_links=self.fetch_links
            )

        if not obj:
            from backbone.core.exceptions import NotFoundException

            raise NotFoundException(f"{self.model.__name__} not found.")

        return obj


class ListMixin(ViewContext):
    """Provides paginated, searchable, filterable list functionality."""

    async def get_queryset(self, request: Request, user: Any) -> dict[str, Any]:
        """
        Base query that all list requests start from.
        Automatically excludes soft-deleted records.
        Override to add user-scoped filtering.
        """
        return {"is_deleted": {"$ne": True}}

    async def filter_queryset(self, base_query: dict[str, Any], request: Request) -> dict[str, Any]:
        """
        Apply search and field-level filters from URL query params.
        """
        base_query = await self._apply_search_filter(base_query, request)
        base_query = await self._apply_field_filters(base_query, request)
        return base_query

    async def _apply_search_filter(self, query: dict[str, Any], request: Request) -> dict[str, Any]:
        search_term = request.query_params.get("search")
        if search_term and self.search_fields:
            escaped_term = re.escape(search_term)
            query["$or"] = [
                {field: {"$regex": escaped_term, "$options": "i"}} for field in self.search_fields
            ]
        return query

    async def _apply_field_filters(self, query: dict[str, Any], request: Request) -> dict[str, Any]:
        from backbone.repositories.base import _FILTER_OPERATOR_MAP

        for param_key, raw_value in request.query_params.items():
            if param_key in _SYSTEM_QUERY_PARAMS:
                continue

            field_name, operator = _extract_field_and_operator(param_key)

            if field_name not in self.filter_fields:
                continue

            if operator and operator in _FILTER_OPERATOR_MAP:
                mongo_filter = build_mongo_filter_from_operator(field_name, operator, raw_value)
                query.update(mongo_filter)
            else:
                # ? Plain equality filter (also handles no-operator case)
                query[field_name] = raw_value

        return query

    async def perform_list(
        self,
        query: dict[str, Any],
        skip: int,
        limit: int,
        sort: str | None,
    ) -> tuple[list[Document], int]:
        return await self.repository.list(
            query, skip=skip, limit=limit, sort=sort, fetch_links=self.fetch_links
        )

    def format_list_response(
        self,
        results: list[Document],
        total_count: int,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        return {
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": ceil(total_count / page_size) if page_size else 1,
            "results": results,
        }


class CreateMixin(ViewContext):
    """Provides document creation with lifecycle hooks."""

    async def before_create(self, data: dict[str, Any], user: Any) -> dict[str, Any]:
        """Called before inserting the document. Inject audit fields here."""
        return data

    async def perform_create(self, data: dict[str, Any]) -> Document:
        return await self.repository.create(data)

    async def after_create(self, instance: Document, user: Any) -> Document:
        """Called after the document is inserted. Trigger side effects here."""
        return instance


class RetrieveMixin(ViewContext):
    """Provides single-object retrieval."""

    async def perform_retrieve(self, lookup_value: str, request: Request, user: Any) -> Document:
        return await self.get_object_by_lookup(lookup_value, request, user)


class UpdateMixin(ViewContext):
    """Provides partial (PATCH) update with lifecycle hooks."""

    async def before_update(
        self, instance: Document, data: dict[str, Any], user: Any
    ) -> dict[str, Any]:
        return data

    async def perform_update(self, instance: Document, data: dict[str, Any]) -> Document:
        document_id = instance.id
        if document_id is None:
            raise ValueError("Cannot update a document without an id.")
        updated = await self.repository.update(document_id, data)
        if updated is None:
            raise ValueError("Update returned no document.")
        return updated

    async def after_update(self, instance: Document, user: Any) -> Document:
        return instance


class DeleteMixin(ViewContext):
    """Provides soft-delete (default) or hard-delete capability."""

    soft_delete: ClassVar[bool] = True

    async def perform_delete(self, instance: Document, user: Any = None) -> None:
        deleted_by = str(user.id) if user else None
        document_id = instance.id
        if document_id is None:
            raise ValueError("Cannot delete a document without an id.")
        await self.repository.delete(document_id, soft=self.soft_delete, deleted_by=deleted_by)
