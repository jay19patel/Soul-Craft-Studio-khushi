"""
* backbone/core/database.py
? Motor + Beanie initialization. Supports swappable client for testing.
"""

import logging
from typing import Any, cast

from beanie import Document, init_beanie
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from backbone.compat.beanie_motor_aggregate import apply_beanie_motor_aggregate_patch
from backbone.config import BackboneSettings
from backbone.config import settings as default_settings

logger = logging.getLogger("backbone.core.database")

_motor_client: AsyncIOMotorClient | None = None


def get_motor_client() -> AsyncIOMotorClient | None:
    return _motor_client


async def init_database(
    document_models: list[type[Document] | str | Any],
    app_settings: BackboneSettings | None = None,
    motor_client: AsyncIOMotorClient | None = None,
) -> None:
    """
    Initialize Beanie ODM with a Motor client.

    Args:
        document_models: List of Beanie Document subclasses to register.
        app_settings: Optional settings override; falls back to global singleton.
        motor_client: Optional pre-built Motor client (useful for testing with mongomock).
    """
    global _motor_client

    resolved_settings = app_settings or default_settings
    logger.info("Connecting to MongoDB database: %s", resolved_settings.DATABASE_NAME)

    if motor_client is not None:
        _motor_client = motor_client
    else:
        _motor_client = AsyncIOMotorClient(resolved_settings.MONGODB_URL)

    database: AsyncIOMotorDatabase = _motor_client[resolved_settings.DATABASE_NAME]

    # ? Beanie 2 ``await aggregate()`` breaks on Motor; patch before init_beanie.
    apply_beanie_motor_aggregate_patch()

    # ? Filter only actual Beanie Document subclasses (guard against plain classes)
    valid_models = [
        model
        for model in document_models
        if isinstance(model, type) and issubclass(model, Document)
    ]

    await init_beanie(
        database=cast(Any, database),
        document_models=valid_models,
        allow_index_dropping=True,
    )
    logger.info("Database initialized with %d document models.", len(valid_models))


async def close_database() -> None:
    """Close the Motor client gracefully on app shutdown."""
    global _motor_client
    if _motor_client is not None:
        _motor_client.close()
        _motor_client = None
        logger.info("Database connection closed.")
