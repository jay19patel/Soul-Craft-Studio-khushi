"""
* backbone/services/tasks.py
? Background task system with two execution modes:

  1. In-process (asyncio) — fire-and-forget for quick, non-critical work.
  2. Redis queue — durable distributed tasks processed by the backbone worker.

Usage::

    from backbone.services.tasks import task_service

    # In-process (asyncio)
    await task_service.run_in_background(send_notification, user_id="abc")

    # Redis-backed (durable, survives restart)
    await task_service.enqueue("myapp.tasks.send_notification", user_id="abc")
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
    Dual-mode background task service.
    """

    def __init__(self, app_settings: BackboneSettings | None = None) -> None:
        self._settings = app_settings or default_settings
        self._redis = self._create_redis_client()

    def _create_redis_client(self):
        try:
            import redis.asyncio as aioredis

            return aioredis.from_url(self._settings.REDIS_URL, decode_responses=True)
        except ImportError:
            logger.warning("redis not installed; Redis-backed tasks unavailable.")
            return None

    # ── In-Process Tasks (asyncio.create_task) ─────────────────────────────

    def run_in_background(self, async_func: Callable, *args: Any, **kwargs: Any) -> asyncio.Task:
        """
        Schedule an async function to run concurrently inside the current event loop.
        Best for fast, stateless side effects (e.g. sending an email after a response).

        Example::
            task_service.run_in_background(send_welcome_email, to_email=user.email)
        """

        async def _wrapper():
            try:
                await async_func(*args, **kwargs)
            except Exception as exc:
                logger.error(
                    "Background task '%s' failed: %s", async_func.__name__, exc, exc_info=True
                )

        return asyncio.create_task(_wrapper())

    # ── Redis-Backed Distributed Tasks ─────────────────────────────────────

    async def enqueue(self, func_dotted_path: str, *args: Any, **kwargs: Any) -> str:
        """
        Push a task onto the Redis queue for processing by a backbone worker.
        The function is referenced by its fully-qualified import path.

        Example::
            await task_service.enqueue("myapp.jobs.process_invoice", invoice_id="123")
        """
        task_id = str(uuid.uuid4())
        task_payload = {
            "id": task_id,
            "func": func_dotted_path,
            "args": list(args),
            "kwargs": kwargs,
            "queued_at": datetime.now(UTC).isoformat(),
        }

        await self._persist_task_log(task_id, func_dotted_path, TaskStatus.QUEUED)

        if self._redis:
            await self._redis.rpush(
                self._settings.TASK_QUEUE_NAME,
                json.dumps(task_payload, default=str),
            )
            logger.info("Task enqueued: %s (id=%s)", func_dotted_path, task_id)
        else:
            logger.warning("Redis unavailable. Task '%s' not enqueued.", func_dotted_path)

        return task_id

    async def _persist_task_log(
        self,
        task_id: str,
        function_name: str,
        status: TaskStatus,
    ) -> None:
        """Write a Task log record to MongoDB for observability."""
        try:
            from backbone.domain.models import Task

            await Task(
                task_id=task_id,
                function_name=function_name,
                status=status,
            ).insert()
        except Exception as exc:
            logger.warning("Failed to persist task log: %s", exc)


class BackboneWorker:
    """
    Redis queue consumer that processes tasks enqueued via TaskService.enqueue().
    Run via:  python -m backbone.cli worker
    """

    def __init__(self, app_settings: BackboneSettings | None = None) -> None:
        self._settings = app_settings or default_settings
        self._is_running = False

    async def start(self) -> None:
        """
        Start the worker loop. Blocks until stop() is called.
        BLPOP with a 5-second timeout keeps the loop alive and responsive.
        """
        import redis.asyncio as aioredis

        redis_client = aioredis.from_url(self._settings.REDIS_URL, decode_responses=True)
        self._is_running = True
        logger.info("Backbone worker started — queue: %s", self._settings.TASK_QUEUE_NAME)

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

        await self._execute_task(task_id, func_path, args, kwargs)

    async def _execute_task(
        self,
        task_id: str,
        func_path: str,
        args: list,
        kwargs: dict,
    ) -> None:
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
                error_traceback=error_trace,
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

    async def _update_task_status(self, task_id: str, status: TaskStatus, **extra_fields) -> None:
        try:
            from backbone.domain.models import Task

            task = await Task.find_one({"task_id": task_id})
            if task:
                await task.set({"status": status, **extra_fields})
        except Exception as exc:
            logger.warning("Failed to update task log for %s: %s", task_id, exc)


# ? Module-level singleton
task_service = TaskService()
