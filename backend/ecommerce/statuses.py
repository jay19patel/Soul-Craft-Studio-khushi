"""
* ecommerce/statuses.py
? Order and payment lifecycle strings: one ``Literal`` definition each, validated via Pydantic
  ``TypeAdapter`` so API code never duplicates allowed-value sets.
"""

from __future__ import annotations

from typing import Any, Literal, get_args

from pydantic import TypeAdapter

# ? Single source of truth — document fields and API validation both use these aliases.
OrderStatus = Literal["pending", "processing", "shipped", "delivered", "cancelled"]
PaymentStatus = Literal["pending", "received", "verified", "failed"]

_order_status_adapter: TypeAdapter[OrderStatus] = TypeAdapter(OrderStatus)
_payment_status_adapter: TypeAdapter[PaymentStatus] = TypeAdapter(PaymentStatus)

# ? Human-facing order matches the fulfillment / payment lifecycles (same as ``Literal`` order).
ORDER_STATUS_CHOICES: tuple[str, ...] = get_args(OrderStatus)
PAYMENT_STATUS_CHOICES: tuple[str, ...] = get_args(PaymentStatus)


def parse_order_status(value: Any) -> OrderStatus:
    """Return ``value`` as an ``OrderStatus``, or raise ``pydantic.ValidationError``."""
    return _order_status_adapter.validate_python(value)


def parse_payment_status(value: Any) -> PaymentStatus:
    """Return ``value`` as a ``PaymentStatus``, or raise ``pydantic.ValidationError``."""
    return _payment_status_adapter.validate_python(value)
