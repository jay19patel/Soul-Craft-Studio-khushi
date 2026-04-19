"""
* backbone/services/scheduler.py
? APScheduler-based cron and interval job scheduler for Backbone apps.

Usage::

    from backbone.services.scheduler import scheduler

    # Decorator style
    @scheduler.cron(hour=2, minute=0)
    async def run_nightly_cleanup():
        await cleanup_old_sessions()

    @scheduler.interval(minutes=15)
    async def refresh_leaderboard():
        await update_leaderboard_cache()

    # Programmatic style
    scheduler.add_cron_job(my_function, hour=3, minute=30)
    scheduler.add_interval_job(my_function, seconds=60)

The scheduler is started/stopped automatically by setup_backbone().
"""

import logging
from collections.abc import Callable
from typing import Any

logger = logging.getLogger("backbone.services.scheduler")


class BackboneScheduler:
    """
    Thin wrapper around APScheduler's AsyncIOScheduler.
    Falls back gracefully if apscheduler is not installed.
    """

    def __init__(self) -> None:
        self._scheduler = self._build_apscheduler_instance()
        self._pending_jobs: list = []  # jobs registered before start()

    def _build_apscheduler_instance(self):
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler

            return AsyncIOScheduler(timezone="UTC")
        except ImportError:
            logger.warning(
                "apscheduler not installed. Scheduled jobs will not run. "
                "Install it with:  pip install apscheduler>=3.10"
            )
            return None

    # ── Job Registration ───────────────────────────────────────────────────

    def add_cron_job(
        self,
        func: Callable,
        year: str | None = None,
        month: str | None = None,
        day: str | None = None,
        week: str | None = None,
        day_of_week: str | None = None,
        hour: Any | None = None,
        minute: Any | None = None,
        second: Any | None = None,
        job_id: str | None = None,
        **kwargs: Any,
    ) -> None:
        """Register a cron-style job. Uses APScheduler's cron trigger."""
        if not self._scheduler:
            return

        cron_kwargs = {
            k: v
            for k, v in {
                "year": year,
                "month": month,
                "day": day,
                "week": week,
                "day_of_week": day_of_week,
                "hour": hour,
                "minute": minute,
                "second": second,
            }.items()
            if v is not None
        }

        self._scheduler.add_job(
            func,
            trigger="cron",
            id=job_id or func.__name__,
            replace_existing=True,
            **cron_kwargs,
        )
        logger.info("Cron job registered: %s — %s", func.__name__, cron_kwargs)

    def add_interval_job(
        self,
        func: Callable,
        weeks: int = 0,
        days: int = 0,
        hours: int = 0,
        minutes: int = 0,
        seconds: int = 0,
        job_id: str | None = None,
    ) -> None:
        """Register an interval-style job."""
        if not self._scheduler:
            return

        interval_kwargs = {
            k: v
            for k, v in {
                "weeks": weeks,
                "days": days,
                "hours": hours,
                "minutes": minutes,
                "seconds": seconds,
            }.items()
            if v
        }

        self._scheduler.add_job(
            func,
            trigger="interval",
            id=job_id or func.__name__,
            replace_existing=True,
            **interval_kwargs,
        )
        logger.info("Interval job registered: %s — every %s", func.__name__, interval_kwargs)

    # ── Decorator API ──────────────────────────────────────────────────────

    def cron(
        self,
        year: str | None = None,
        month: str | None = None,
        day: str | None = None,
        week: str | None = None,
        day_of_week: str | None = None,
        hour: Any | None = None,
        minute: Any | None = None,
        second: Any | None = None,
    ) -> Callable:
        """
        Decorator that registers an async function as a cron job.

        Example::
            @scheduler.cron(hour=0, minute=0)
            async def midnight_job():
                ...
        """

        def decorator(func: Callable) -> Callable:
            self.add_cron_job(
                func,
                year=year,
                month=month,
                day=day,
                week=week,
                day_of_week=day_of_week,
                hour=hour,
                minute=minute,
                second=second,
            )
            return func

        return decorator

    def interval(
        self,
        weeks: int = 0,
        days: int = 0,
        hours: int = 0,
        minutes: int = 0,
        seconds: int = 0,
    ) -> Callable:
        """
        Decorator that registers an async function as an interval job.

        Example::
            @scheduler.interval(minutes=30)
            async def every_half_hour():
                ...
        """

        def decorator(func: Callable) -> Callable:
            self.add_interval_job(
                func, weeks=weeks, days=days, hours=hours, minutes=minutes, seconds=seconds
            )
            return func

        return decorator

    # ── Lifecycle ──────────────────────────────────────────────────────────

    def start(self) -> None:
        if self._scheduler and not self._scheduler.running:
            self._scheduler.start()
            logger.info("Backbone scheduler started.")

    def stop(self) -> None:
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("Backbone scheduler stopped.")

    @property
    def is_running(self) -> bool:
        return bool(self._scheduler and self._scheduler.running)


# ? Module-level singleton — importable directly
scheduler = BackboneScheduler()
