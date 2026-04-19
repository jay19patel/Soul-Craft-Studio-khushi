"""
* backbone/compat/beanie_motor_aggregate.py
? Beanie 2 assumes PyMongo async ``aggregate()`` returns an awaitable coroutine.
  Motor 3.7+ returns a cursor directly, so Beanie's ``await collection.aggregate(...)``
  raises ``TypeError: AsyncIOMotorLatentCommandCursor can't be used in 'await'``.
  This module patches the few Beanie call sites to await only when the return value
  is awaitable, so Motor keeps working.
"""

from __future__ import annotations

import inspect
import logging
from typing import Any

logger = logging.getLogger("backbone.compat.beanie_motor_aggregate")

_is_patch_applied = False


async def _aggregate_cursor(
    collection: Any,
    pipeline: list[dict[str, Any]],
    session: Any,
    pymongo_kwargs: dict[str, Any],
) -> Any:
    """Return an aggregation cursor for both Motor (sync) and PyMongo async drivers."""
    raw_result = collection.aggregate(
        pipeline,
        session=session,
        **pymongo_kwargs,
    )
    if inspect.isawaitable(raw_result):
        return await raw_result
    return raw_result


def apply_beanie_motor_aggregate_patch() -> None:
    """Idempotent monkey-patch; call once before ``init_beanie`` when using Motor."""
    global _is_patch_applied
    if _is_patch_applied:
        return

    from beanie.odm.queries import aggregation as aggregation_module
    from beanie.odm.queries import find as find_module
    from beanie.odm.utils.projection import get_projection

    FindMany = find_module.FindMany
    FindQuery = find_module.FindQuery
    AggregationQuery = aggregation_module.AggregationQuery

    async def patched_find_many_get_cursor(self: Any) -> Any:
        if self.fetch_links:
            aggregation_pipeline: list[dict[str, Any]] = self.build_aggregation_pipeline()
            projection = get_projection(self.projection_model)
            if projection is not None:
                aggregation_pipeline.append({"$project": projection})
            return await _aggregate_cursor(
                self.document_model.get_pymongo_collection(),
                aggregation_pipeline,
                self.session,
                self.pymongo_kwargs,
            )
        return self.document_model.get_pymongo_collection().find(
            filter=self.get_filter_query(),
            sort=self.sort_expressions,
            projection=get_projection(self.projection_model),
            skip=self.skip_number,
            limit=self.limit_number,
            session=self.session,
            **self.pymongo_kwargs,
        )

    async def patched_find_many_count(self: Any) -> int:
        if self.fetch_links:
            aggregation_pipeline: list[dict[str, Any]] = self.build_aggregation_pipeline()
            aggregation_pipeline.append({"$count": "count"})
            cursor = await _aggregate_cursor(
                self.document_model.get_pymongo_collection(),
                aggregation_pipeline,
                self.session,
                self.pymongo_kwargs,
            )
            result = await cursor.to_list(length=1)
            return result[0]["count"] if result else 0
        return await FindQuery.count(self)

    async def patched_aggregation_get_cursor(self: Any) -> Any:
        aggregation_pipeline = self.get_aggregation_pipeline()
        return await _aggregate_cursor(
            self.document_model.get_pymongo_collection(),
            aggregation_pipeline,
            self.session,
            self.pymongo_kwargs,
        )

    FindMany.get_cursor = patched_find_many_get_cursor
    FindMany.count = patched_find_many_count
    AggregationQuery.get_cursor = patched_aggregation_get_cursor

    _is_patch_applied = True
    logger.debug("Beanie Motor aggregate compatibility patch applied.")
