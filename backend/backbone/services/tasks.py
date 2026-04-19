"""
* backbone/services/tasks.py
? Unified background task system with two execution modes:

  1. In-process (asyncio) — fire-and-forget for quick, non-critical work.
  2. Redis queue — durable distributed tasks processed by the backbone worker.

  Both modes automatically log to the MongoDB ``task_logs`` collection for auditing.
"""

import asyncio
import importlib
import json
import logging
import traceback
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any, cast

from backbone.config import BackboneSettings
from backbone.config import settings as default_settings
from backbone.core.enums import TaskStatus

logger = logging.getLogger("backbone.services.tasks")


class TaskService:
    """
    Unified background task service with auditing.
    """

    def __init__(self, app_settings: BackboneSettings | None = None) -> None:
        self._settings = app_settings or default_settings
        self._redis = self._create_redis_client()

    def _create_redis_client(self):
        try:
            import redis.asyncio as aioredis

            return aioredis.from_url(self._settings.REDIS_URL, decode_responses=True)
        except ImportError:
            if self._settings.TASK_BACKEND == "redis":
                logger.warning("redis not installed; Redis-backed tasks unavailable.")
            return None

    # ── Unified Task Entry Point ───────────────────────────────────────────

    async def enqueue(self, func_dotted_path: str, *args: Any, **kwargs: Any) -> str:
        """
        Schedule a function to run in the background.
        The function is referenced by its fully-qualified import path.

        Depending on ``settings.TASK_BACKEND``:
        - "asyncio": Runs immediately in the background using asyncio.create_task.
        - "redis": Pushes to Redis for an external worker process.

        Both modes create an audit entry in the MongoDB ``task_logs`` collection.
        """
        task_id = str(uuid.uuid4())
        
        # 1. Always create the audit record
        await self._update_task_status(
            task_id, 
            TaskStatus.QUEUED, 
            function_name=func_dotted_path,
            created_at=datetime.now(UTC),
            queued_at=datetime.now(UTC)
        )

        if self._settings.TASK_BACKEND == "redis":
            return await self._enqueue_to_redis(task_id, func_dotted_path, args, kwargs)
        
        # Default: asyncio (internal)
        return self._run_via_asyncio(task_id, func_dotted_path, args, kwargs)

    # ── Backend: Redis ─────────────────────────────────────────────────────

    async def _enqueue_to_redis(self, task_id: str, func_dotted_path: str, args: tuple, kwargs: dict) -> str:
        if not self._redis:
            logger.error("Redis backend requested but Redis is unavailable. Task %s failed.", task_id)
            await self._update_task_status(task_id, TaskStatus.FAILED, error_message="Redis unavailable")
            return task_id

        task_payload = {
            "id": task_id,
            "func": func_dotted_path,
            "args": list(args),
            "kwargs": kwargs,
            "queued_at": datetime.now(UTC).isoformat(),
        }

        await self._redis.rpush(
            self._settings.TASK_QUEUE_NAME,
            json.dumps(task_payload, default=str),
        )
        logger.info("Task enqueued to Redis: %s (id=%s)", func_dotted_path, task_id)
        return task_id

    # ── Backend: Asyncio (Local) ───────────────────────────────────────────

    def _run_via_asyncio(self, task_id: str, func_dotted_path: str, args: tuple, kwargs: dict) -> str:
        """Standard fire-and-forget using the current event loop."""
        asyncio.create_task(self.execute_task(task_id, func_dotted_path, list(args), kwargs))
        logger.info("Task started via asyncio: %s (id=%s)", func_dotted_path, task_id)
        return task_id

    # ── Task Execution & Auditing ──────────────────────────────────────────

    async def execute_task(
        self,
        task_id: str,
        func_path: str,
        args: list,
        kwargs: dict,
    ) -> None:
        """
        The actual execution wrapper. Shared between Local Asyncio and Distributed Worker modes.
        Handles auditing (Processing -> Completed/Failed).
        """
        started_at = datetime.now(UTC)
        await self._update_task_status(task_id, TaskStatus.PROCESSING, started_at=started_at)

        try:
            func = self._resolve_function(func_path)
            if asyncio.iscoroutinefunction(func):
                await func(*args, **kwargs)
            else:
                await asyncio.to_thread(func, *args, **kwargs)

            execution_seconds = (datetime.now(UTC) - started_at).total_seconds()
            await self._update_task_status(
                task_id,
                TaskStatus.COMPLETED,
                completed_at=datetime.now(UTC),
                execution_time_seconds=execution_seconds,
            )
            logger.info("Task completed: %s (%.2fs)", func_path, execution_seconds)

        except Exception as exc:
            error_trace = traceback.format_exc()
            await self._update_task_status(
                task_id,
                TaskStatus.FAILED,
                error_message=str(exc),
                metadata={"traceback": error_trace},
            )
            logger.error("Task failed: %s — %s", func_path, exc, exc_info=True)

    def _resolve_function(self, func_dotted_path: str) -> Callable:
        """Dynamically import and return a callable by its dotted path."""
        module_path, func_name = func_dotted_path.rsplit(".", 1)
        module = importlib.import_module(module_path)
        func = getattr(module, func_name)
        if not callable(func):
            raise TypeError(f"'{func_dotted_path}' is not callable.")
        return func

    async def _update_task_status(self, task_id: str, status: TaskStatus, **fields) -> None:
        """Atomic upsert/update of the Task record in MongoDB."""
        try:
            from backbone.domain.models import Task

            task = await Task.find_one({"task_id": task_id})
            if not task:
                # ? For the initial QUEUED state, we might need to insert first
                if "function_name" in fields:
                    task = Task(task_id=task_id, status=status, **fields)
                    await task.insert()
                return

            await task.set({"status": status, **fields})
        except Exception as exc:
            logger.warning("Failed to update task status for %s: %s", task_id, exc)


class BackboneWorker:
    """
    Redis queue consumer that processes tasks enqueued via TaskService.enqueue(TASK_BACKEND='redis').
    Run via:  python -m backbone.cli worker
    """

    def __init__(self, app_settings: BackboneSettings | None = None) -> None:
        self._settings = app_settings or default_settings
        self._is_running = False
        self._service = TaskService(app_settings=app_settings)

    async def start(self) -> None:
        """
        Start the worker loop. Blocks until stop() is called.
        """
        import redis.asyncio as aioredis

        redis_client = aioredis.from_url(self._settings.REDIS_URL, decode_responses=True)
        self._is_running = True
        logger.info("Backbone worker started — mode: redis, queue: %s", self._settings.TASK_QUEUE_NAME)

        while self._is_running:
            try:
                blpop_waitable = redis_client.blpop([self._settings.TASK_QUEUE_NAME], timeout=5)
                result = await cast(Awaitable[tuple[str, str] | None], blpop_waitable)
                if result:
                    _, raw_payload = result
                    await self._process_raw_task_payload(raw_payload)
            except Exception as exc:
                logger.error("Worker loop error: %s", exc, exc_info=True)
                await asyncio.sleep(1)

        await redis_client.aclose()
        logger.info("Backbone worker stopped.")

    def stop(self) -> None:
        self._is_running = False

    async def _process_raw_task_payload(self, raw_payload: str) -> None:
        try:
            task_data: dict[str, Any] = json.loads(raw_payload)
        except json.JSONDecodeError as exc:
            logger.error("Malformed task payload: %s — %s", raw_payload, exc)
            return

        task_id: str = task_data.get("id", "unknown")
        func_path: str = task_data.get("func", "")
        args = task_data.get("args", [])
        kwargs = task_data.get("kwargs", {})

        await self._service.execute_task(task_id, func_path, args, kwargs)


# ? Module-level singleton
task_service = TaskService()
