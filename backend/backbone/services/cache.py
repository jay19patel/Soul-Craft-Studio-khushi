"""
* backbone/services/cache.py
? Redis-backed cache service with JSON serialization.
  Gracefully no-ops when CACHE_ENABLED=False.
"""

import json
import logging
from typing import Any

from backbone.config import BackboneSettings
from backbone.config import settings as default_settings

logger = logging.getLogger("backbone.services.cache")


class CacheService:
    """
    Async Redis cache service.
    All methods are safe to call even when Redis is unavailable or disabled.
    """

    def __init__(self, app_settings: BackboneSettings | None = None) -> None:
        self._settings = app_settings or default_settings
        self._redis = self._create_redis_client()

    def _create_redis_client(self):
        if not self._settings.CACHE_ENABLED:
            return None
        try:
            import redis.asyncio as aioredis

            return aioredis.from_url(self._settings.REDIS_URL, decode_responses=True)
        except ImportError:
            logger.warning("redis package not installed. Cache is disabled.")
            return None

    @property
    def is_available(self) -> bool:
        return self._redis is not None and self._settings.CACHE_ENABLED

    async def get(self, cache_key: str) -> Any | None:
        if not self.is_available:
            return None
        try:
            raw = await self._redis.get(cache_key)
            return json.loads(raw) if raw else None
        except Exception as exc:
            logger.warning("Cache GET failed for key '%s': %s", cache_key, exc)
            return None

    async def set(
        self,
        cache_key: str,
        value: Any,
        ttl_seconds: int | None = None,
    ) -> bool:
        if not self.is_available:
            return False
        resolved_ttl = ttl_seconds or self._settings.CACHE_TTL_SECONDS
        try:
            await self._redis.set(cache_key, json.dumps(value, default=str), ex=resolved_ttl)
            return True
        except Exception as exc:
            logger.warning("Cache SET failed for key '%s': %s", cache_key, exc)
            return False

    async def delete(self, cache_key: str) -> bool:
        if not self.is_available:
            return False
        try:
            await self._redis.delete(cache_key)
            return True
        except Exception as exc:
            logger.warning("Cache DELETE failed for key '%s': %s", cache_key, exc)
            return False

    async def flush_all(self) -> bool:
        """Flush the entire Redis cache. Use only in development or CLI tools."""
        if not self.is_available:
            return False
        try:
            await self._redis.flushdb()
            logger.info("Cache flushed.")
            return True
        except Exception as exc:
            logger.error("Cache FLUSHDB failed: %s", exc)
            return False


# ? Module-level singleton
cache_service = CacheService()
