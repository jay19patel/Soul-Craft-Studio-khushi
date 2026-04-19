"""
* ecommerce/models.py
? Beanie documents for a storefront: categories, products, carts, orders, payments,
  plus FAQs, testimonials, and contact messages.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from beanie import Document, Link, PydanticObjectId
from bson import DBRef
from pydantic import BaseModel, Field, field_serializer, field_validator
from pymongo import ASCENDING, DESCENDING, IndexModel

from backbone.domain.base import BackboneDocument
from backbone.domain.models import Attachment, User
from ecommerce.statuses import OrderStatus, PaymentStatus


def link_to_existing_document(document_class: type[Document], document_id: str) -> Link:
    """
    Build a Beanie ``Link`` from a collection name + id (no in-memory document graph).

    Use this instead of ``Payment(order=order_instance)`` so ``Order`` and ``Payment``
    do not hold circular Python references (which break FastAPI JSON serialization).
    """
    collection_name = (
        getattr(getattr(document_class, "Settings", None), "name", None)
        or document_class.__name__.lower()
    )
    parsed_id = PydanticObjectId(str(document_id).strip())
    return Link(DBRef(collection_name, parsed_id), document_class)


def _serialize_cross_document_link_as_id_dict(value: Any) -> dict[str, str] | None:
    """JSON-safe stub for a linked document (avoids ``Order`` ↔ ``Payment`` recursion)."""
    if value is None:
        return None
    resolved_id = getattr(value, "id", None)
    if resolved_id is None:
        link_ref = getattr(value, "ref", None)
        if link_ref is not None:
            resolved_id = getattr(link_ref, "id", None)
    if resolved_id is None:
        return None
    return {"id": str(resolved_id)}


class Category(BackboneDocument):
    name: str = Field(max_length=200, description="Display name of the category")
    image_url: str | None = Field(default=None, description="Hero or tile image URL")
    color: str | None = Field(default=None, description="Optional CSS color token")
    description: str | None = Field(default=None, description="Short blurb for the storefront")

    class Settings:
        name = "categories"
        indexes = [
            IndexModel(
                [("name", ASCENDING)],
                unique=True,
                partialFilterExpression={"is_deleted": {"$eq": False}},
                name="unique_active_category_name",
            ),
        ]


class Product(BackboneDocument):
    name: str = Field(max_length=300, description="Product title shown to customers")
    slug: str = Field(
        default="",
        description="URL segment; auto-generated when left empty",
        json_schema_extra={"slugify": True, "populate_from": "name"},
    )
    price: str = Field(description="Human-readable price, e.g. ₹1,499")
    price_value: float = Field(default=0.0, description="Numeric amount for cart and orders")
    is_published: bool = Field(
        default=True,
        description="When false, hidden from the default public product list",
    )
    primary_image: Link[Attachment] | None = Field(
        default=None,
        description="Main product image (admin attachment picker, same pattern as User.profile_image)",
    )
    gallery_images: list[Link[Attachment]] = Field(
        default_factory=list,
        description="Gallery images (multiple Attachment links)",
    )
    tag: str | None = Field(default=None, max_length=80, description="Badge text such as New")
    category_id: str | None = Field(default=None, description="Category document id string")
    stock: int = Field(default=10, ge=0, description="Available inventory")
    description: str | None = Field(default=None, description="Long marketing copy")
    details: str | None = Field(default=None, description="Specifications or bullet-style text")

    class Settings:
        name = "products"
        indexes = [
            IndexModel([("name", ASCENDING)], unique=False),
            IndexModel([("tag", ASCENDING)], unique=False),
            IndexModel([("category_id", ASCENDING)], unique=False),
            IndexModel([("slug", ASCENDING)], unique=False),
            IndexModel([("is_published", ASCENDING)], unique=False),
        ]


class CartItem(BackboneDocument):
    cart: Link[Cart] | None = Field(default=None, description="Linked parent cart")
    product: Link[Product] = Field(description="Line item product reference")
    quantity: int = Field(default=1, ge=1)
    name: str = Field(description="Snapshot of the product title")

    class Settings:
        name = "cart_items"
        indexes = [
            IndexModel([("cart", ASCENDING)]),
        ]


class Cart(BackboneDocument):
    user: Link[User] | None = Field(default=None, description="Linked owner account")
    items: list[Link[CartItem]] = Field(default_factory=list, description="Linked line rows")
    total_amount: float = Field(default=0.0, description="Sum of line totals")
    # ? ``is_ordered=True`` marks this cart as checked out; the order's ``cart`` field is the link back.
    is_ordered: bool = Field(default=False, description="True after checkout completes")

    class Settings:
        name = "carts"
        indexes = [
            IndexModel([("user", ASCENDING)], name="cart_user_link_index"),
            IndexModel(
                [("user", ASCENDING)],
                unique=True,
                partialFilterExpression={
                    "is_ordered": False,
                    "user": {"$gt": None},
                },
                name="unique_active_cart_per_user",
            ),
        ]


class OrderItem(BackboneDocument):
    """Immutable snapshot of one purchased line, now a separate document for admin visibility."""

    order: Link[Order] | None = Field(default=None, description="Linked parent order")
    product: Link[Product] | None = Field(default=None, description="Linked product at purchase time")
    product_id: str | None = Field(default=None, description="Flat product id for historical reference")
    cart_item_id: str | None = Field(default=None, description="Source cart line id, if any")
    name: str = Field(description="Product title at purchase time")
    price: float = Field(description="Unit price at purchase time (frozen)")
    image: str | None = Field(default=None, description="Image URL at purchase time")
    quantity: int = Field(default=1, ge=1)
    subtotal: float = Field(default=0.0, description="price × quantity")

    @field_validator("price", mode="before")
    @classmethod
    def parse_order_item_price(cls, raw_value: Any) -> float:
        if isinstance(raw_value, str):
            numeric_str = re.sub(r"[^\d.]", "", raw_value)
            return float(numeric_str) if numeric_str else 0.0
        return float(raw_value or 0.0)

    class Settings:
        name = "order_items"
        indexes = [
            IndexModel([("order", ASCENDING)]),
            IndexModel([("product", ASCENDING)]),
        ]


class Order(BackboneDocument):
    user: Link[User] | None = Field(default=None, description="Purchasing user account")
    customer_name: str = Field(max_length=200)
    customer_email: str = Field(max_length=320)

    @field_validator("customer_email")
    @classmethod
    def normalize_customer_email(cls, value: str) -> str:
        return value.lower().strip() if value else value

    customer_phone: str | None = Field(default=None, max_length=40)
    shipping_address: str = Field(description="Full postal address")
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    pincode: str | None = Field(default=None, max_length=20)
    items: list[Link[OrderItem]] = Field(default_factory=list, description="Linked order line documents")
    total_amount: float = Field(default=0.0)
    status: OrderStatus = Field(default="pending", description="Fulfillment pipeline stage")
    payment_status: PaymentStatus = Field(default="pending", description="Money collection stage")
    payment_id: str | None = Field(default=None, description="Customer-reported transaction id")
    payment: Link[Payment] | None = Field(default=None, description="Linked payment row")
    cart: Link[Cart] | None = Field(default=None, description="Cart used for checkout, if any")
    notes: str | None = Field(default=None)

    @field_serializer("payment")
    def serialize_payment_link_for_api(self, payment: Any) -> dict[str, str] | None:
        return _serialize_cross_document_link_as_id_dict(payment)

    @field_serializer("user")
    def serialize_user_link_for_api(self, user: Any) -> dict[str, str] | None:
        return _serialize_cross_document_link_as_id_dict(user)

    @field_serializer("cart")
    def serialize_cart_link_for_api(self, cart: Any) -> dict[str, str] | None:
        return _serialize_cross_document_link_as_id_dict(cart)

    class Settings:
        name = "orders"
        indexes = [
            IndexModel([("customer_email", ASCENDING)], unique=False),
            IndexModel([("user", ASCENDING)], unique=False),
            IndexModel([("cart", ASCENDING)], unique=False),
            IndexModel([("created_at", DESCENDING)], unique=False),
            IndexModel([("status", ASCENDING)], unique=False),
            IndexModel([("payment_status", ASCENDING)], unique=False),
        ]

    # ── Resilient Data Correction ───────────────────────────────────────────

    @field_validator(
        "payment_id", "notes", "customer_email", "customer_phone", 
        mode="before"
    )
    @classmethod
    def coerce_none_string_for_text_fields(cls, raw: Any) -> Any:
        if isinstance(raw, str) and raw.strip().lower() == "none":
            return None
        return raw

    @field_validator("payment_status", mode="before")
    @classmethod
    def coerce_invalid_payment_status(cls, raw: Any) -> Any:
        if isinstance(raw, str):
            val = raw.strip().lower()
            if val == "complated":
                return "verified"
            if val == "none":
                return "pending"
        return raw


class Payment(BackboneDocument):
    order: Link[Order] = Field(description="Order this payment belongs to")
    user: Link[User] | None = Field(default=None, description="User who made the payment")
    amount: float = Field(description="Amount in the store currency")
    currency: str = Field(default="INR", max_length=8)
    method: str = Field(default="UPI", max_length=40, description="UPI, card, COD, etc.")
    transaction_id: str | None = Field(default=None, description="Gateway or reference id")
    screenshot: Link[Attachment] | None = Field(default=None, description="Linked payment proof screenshot")
    status: PaymentStatus = Field(default="pending", description="Payment row lifecycle stage")
    submitted_at: datetime | None = Field(
        default=None,
        description="When the shopper submitted payment proof",
    )
    received_at: datetime | None = Field(default=None)
    confirmed_at: datetime | None = Field(default=None)
    gateway_response: dict[str, Any] | None = Field(default=None)

    @field_serializer("order")
    def serialize_order_link_for_api(self, order: Any) -> dict[str, str] | None:
        return _serialize_cross_document_link_as_id_dict(order)

    @field_serializer("user")
    def serialize_user_link_for_api(self, user: Any) -> dict[str, str] | None:
        return _serialize_cross_document_link_as_id_dict(user)

    @field_serializer("screenshot")
    def serialize_screenshot_link_for_api(self, screenshot: Any) -> dict[str, str] | None:
        return _serialize_cross_document_link_as_id_dict(screenshot)

    class Settings:
        name = "payments"
        indexes = [
            IndexModel([("transaction_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("order", ASCENDING)]),
            IndexModel([("user", ASCENDING)]),
        ]

    # ── Resilient Data Correction ───────────────────────────────────────────

    @field_validator("status", mode="before")
    @classmethod
    def coerce_invalid_status_payment(cls, raw: Any) -> Any:
        if isinstance(raw, str):
            val = raw.strip().lower()
            if val == "complated":
                return "verified"
        return raw

    @field_validator("submitted_at", "received_at", "confirmed_at", mode="before")
    @classmethod
    def coerce_none_string_for_dates(cls, raw: Any) -> Any:
        if isinstance(raw, str) and raw.strip().lower() == "none":
            return None
        return raw


class FAQ(BackboneDocument):
    question: str = Field(max_length=500)
    answer: str = Field(description="Rich or plain answer text")

    class Settings:
        name = "faqs"
        indexes = [
            IndexModel([("created_at", DESCENDING)], unique=False),
        ]


class Testimonial(BackboneDocument):
    user: Link[User] | None = Field(default=None, description="Linked account when signed in")
    author_name: str | None = Field(default=None, max_length=200)
    content: str = Field(description="Review body")
    rating: int = Field(default=5, ge=1, le=5)
    product_image_url: str | None = Field(default=None, description="Optional product photo URL")
    avatar_url: str | None = Field(default=None, description="Reviewer avatar URL")

    class Settings:
        name = "testimonials"
        indexes = [
            IndexModel([("user", ASCENDING)], unique=False),
            IndexModel([("created_at", DESCENDING)], unique=False),
        ]


class Contact(BackboneDocument):
    name: str = Field(max_length=200)
    email: str = Field(max_length=320)
    subject: str = Field(max_length=300)
    message: str = Field(description="Visitor message body")

    class Settings:
        name = "contacts"
        indexes = [
            IndexModel([("email", ASCENDING)], unique=False),
            IndexModel([("created_at", DESCENDING)], unique=False),
        ]


Category.model_rebuild()
Product.model_rebuild()
CartItem.model_rebuild()
Cart.model_rebuild()
OrderItem.model_rebuild()
Order.model_rebuild()
Payment.model_rebuild()
FAQ.model_rebuild()
Testimonial.model_rebuild()
Contact.model_rebuild()
