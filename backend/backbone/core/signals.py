"""
* backbone/core/signals.py
? Async signal dispatcher for model lifecycle events.
  Usage:
      from backbone.core.signals import signals

      @signals.post_create.connect(User)
      async def on_user_created(instance, **kwargs):
          await send_welcome_email(instance)
"""

import asyncio
import logging
from collections import defaultdict
from collections.abc import Callable
from typing import Any

logger = logging.getLogger("backbone.core.signals")


class Signal:
    """
    An async signal that dispatches to all connected handlers for a model class.
    Handlers are called concurrently via asyncio.gather.
    """

    def __init__(self, name: str) -> None:
        self.name = name
        self._handlers: dict[type, list[Callable]] = defaultdict(list)

    def connect(self, model_class: type) -> Callable:
        """
        Decorator to connect an async function as a handler for a model class.

        Example:
            @signals.post_create.connect(Order)
            async def notify_on_order_created(instance, **kwargs):
                ...
        """

        def decorator(handler: Callable) -> Callable:
            if handler not in self._handlers[model_class]:
                self._handlers[model_class].append(handler)
            return handler

        return decorator

    def disconnect(self, model_class: type, handler: Callable) -> bool:
        handlers = self._handlers.get(model_class, [])
        if handler in handlers:
            handlers.remove(handler)
            return True
        return False

    async def emit(
        self,
        instance: Any,
        model_class: type | None = None,
        **kwargs: Any,
    ) -> None:
        resolved_class = model_class or type(instance)
        handlers = self._handlers.get(resolved_class, [])
        if not handlers:
            return

        coroutines = []
        for handler in handlers:
            if asyncio.iscoroutinefunction(handler):
                coroutines.append(handler(instance, **kwargs))
            else:
                try:
                    handler(instance, **kwargs)
                except Exception as exc:
                    logger.error(
                        "Sync signal handler %s raised an error: %s",
                        handler.__name__,
                        exc,
                        exc_info=True,
                    )

        if coroutines:
            results = await asyncio.gather(*coroutines, return_exceptions=True)
            for result in results:
                if isinstance(result, Exception):
                    logger.error(
                        "Async signal handler for signal '%s' raised: %s",
                        self.name,
                        result,
                        exc_info=False,
                    )


class SignalManager:
    """
    Central registry of all Backbone model lifecycle signals.

    Available signals:
        post_create     — fired after a document is inserted
        post_update     — fired after a document is updated (with changed_fields)
        post_delete     — fired after a document is deleted
        on_field_change — fired only when specific fields change
    """

    def __init__(self) -> None:
        self.post_create = Signal("post_create")
        self.post_update = Signal("post_update")
        self.post_delete = Signal("post_delete")
        self.on_field_change = Signal("on_field_change")


# ? Global singleton — used by AuditDocument and exposed in backbone's public API
signals = SignalManager()
