"""
* backbone/repositories/base.py
? Generic Beanie repository.
  Supports:
    - get by ID or any other field (e.g. slug)
    - advanced list with lookup-operator filtering (?price__gt=100, ?status__in=a,b)
    - pagination (skip/limit)
    - soft-delete and hard-delete
"""

import logging
from datetime import UTC, datetime
from typing import Any, Generic, TypeVar

from beanie import Document, PydanticObjectId
from pydantic import BaseModel

logger = logging.getLogger("backbone.repositories.base")

T = TypeVar("T", bound=Document)

# ? Operators supported in URL query params (e.g. ?price__gt=100)
_FILTER_OPERATOR_MAP: dict[str, str] = {
    "gt": "$gt",
    "gte": "$gte",
    "lt": "$lt",
    "lte": "$lte",
    "ne": "$ne",
    "in": "$in",
    "nin": "$nin",
    "contains": "$regex",
    "startswith": "$regex",
    "endswith": "$regex",
    "exists": "$exists",
}


def build_mongo_filter_from_operator(field: str, operator: str, raw_value: str) -> dict[str, Any]:
    """
    Convert a URL query param operator token into a MongoDB filter expression.
    E.g.: ("price", "gt", "100") → {"price": {"$gt": 100}}
    """
    mongo_operator = _FILTER_OPERATOR_MAP[operator]

    if operator in ("in", "nin"):
        parsed_value: Any = [v.strip() for v in raw_value.split(",")]
    elif operator == "contains":
        parsed_value = {"$regex": raw_value, "$options": "i"}
        return {field: parsed_value}
    elif operator == "startswith":
        parsed_value = {"$regex": f"^{raw_value}", "$options": "i"}
        return {field: parsed_value}
    elif operator == "endswith":
        parsed_value = {"$regex": f"{raw_value}$", "$options": "i"}
        return {field: parsed_value}
    elif operator == "exists":
        parsed_value = raw_value.lower() in ("true", "1", "yes")
    else:
        # ? Attempt numeric coercion; keep as string if it fails
        try:
            parsed_value = int(raw_value)
        except ValueError:
            try:
                parsed_value = float(raw_value)
            except ValueError:
                parsed_value = raw_value

    return {field: {mongo_operator: parsed_value}}


class BaseRepository(Generic[T]):
    """
    Generic CRUD repository for any Beanie Document.

    Usage::

        repo = BaseRepository(Product)
        product = await repo.get("60d21b4967d0d8992e610c85")
        products, total = await repo.list({"is_deleted": {"$ne": True}})
    """

    def __init__(self, model: type[T]) -> None:
        self.model = model

    # ── Read ────────────────────────────────────────────────────────────────

    async def get(
        self,
        document_id: str | PydanticObjectId,
        fetch_links: bool = False,
    ) -> T | None:
        """Fetch a document by its MongoDB _id."""
        return await self.model.get(document_id, fetch_links=fetch_links)

    async def get_by_field(
        self,
        field_name: str,
        field_value: Any,
        fetch_links: bool = False,
    ) -> T | None:
        """Fetch a single document by any field value (e.g. slug, email)."""
        return await self.model.find_one(
            {field_name: field_value},
            fetch_links=fetch_links,
        )

    async def list(
        self,
        query: dict[str, Any],
        skip: int = 0,
        limit: int = 50,
        sort: str | None = None,
        fetch_links: bool = False,
    ) -> tuple[list[T], int]:
        """
        List documents with pagination.

        Returns a (items, total_count) tuple.
        Total count uses a separate count query (MongoDB will optimize this).
        """
        find_query = self.model.find(query, fetch_links=fetch_links)
        total_count = await find_query.count()

        if sort:
            find_query = find_query.sort(sort)

        items = await find_query.skip(skip).limit(limit).to_list()
        return items, total_count

    # ── Write ───────────────────────────────────────────────────────────────

    async def create(self, data: dict[str, Any] | BaseModel) -> T:
        """Insert a new document. Accepts a dict or a Pydantic model."""
        raw_data = data if isinstance(data, dict) else data.model_dump()
        instance = self.model(**raw_data)
        return await instance.insert()

    async def update(
        self,
        document_id: str | PydanticObjectId,
        data: dict[str, Any] | BaseModel,
    ) -> T | None:
        """Partially update a document. Only sets the provided fields."""
        instance = await self.get(document_id)
        if not instance:
            return None

        update_data = data if isinstance(data, dict) else data.model_dump(exclude_unset=True)

        # ? Always touch updated_at if the document has it
        if hasattr(instance, "updated_at"):
            update_data["updated_at"] = datetime.now(UTC)

        await instance.set(update_data)
        return instance

    async def delete(
        self,
        document_id: str | PydanticObjectId,
        soft: bool = True,
        deleted_by: str | None = None,
    ) -> bool:
        """
        Delete a document.
        - soft=True (default): sets is_deleted=True if the document supports it.
        - soft=False: permanently removes the document from the collection.
        """
        instance = await self.get(document_id)
        if not instance:
            return False

        if soft and hasattr(instance, "is_deleted"):
            soft_delete_data: dict[str, Any] = {
                "is_deleted": True,
                "deleted_at": datetime.now(UTC),
            }
            if deleted_by:
                soft_delete_data["deleted_by"] = deleted_by
            await instance.set(soft_delete_data)
        else:
            await instance.delete()

        return True
