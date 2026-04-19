"""
* ecommerce/api/shop.py
? Storefront CRUD: categories, products, carts, orders, payments with checkout hooks.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, ClassVar, cast

from beanie import Document, Link, PydanticObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

from backbone import AllowAny, GenericCrudView, IsAuthenticated
from backbone.core.dependencies import get_current_user
from backbone.domain.models import Attachment, User
from ecommerce.models import (
    Cart,
    CartItem,
    Category,
    Order,
    OrderItem,
    Payment,
    Product,
    link_to_existing_document,
)
from ecommerce.statuses import (
    ORDER_STATUS_CHOICES,
    PAYMENT_STATUS_CHOICES,
    OrderStatus,
    PaymentStatus,
    parse_order_status,
    parse_payment_status,
)


def _extract_id_from_link(link: Link[Any] | Document | Any | None) -> str:
    """Safe helper to get string ID from a link (resolved or unresolved)."""
    if link is None:
        return ""
    if isinstance(link, Link):
        # ? Unresolved Beanie Link
        return str(link.ref.id)
    # ? Resolved Document or other ID-bearing object
    return str(getattr(link, "id", ""))


def _extract_product_id_from_payload(item: Any) -> str | None:
    """Return a product id string from a dict or object-shaped line payload.

    Client payloads always send a plain string id under ``product_id`` or ``product``.
    The dict-shape fallback handles Beanie serialised Link stubs (``{"id": "..."}``).
    """
    if isinstance(item, dict):
        raw = item.get("product_id") or item.get("product")
    else:
        raw = getattr(item, "product_id", None) or getattr(item, "product", None)

    if raw is None:
        return None
    if isinstance(raw, dict):
        raw = raw.get("id") or raw.get("$oid") or raw.get("$id")
    elif hasattr(raw, "id"):
        raw = raw.id
    return str(raw) if raw is not None else None


async def _resolve_product_for_cart_line(line: CartItem) -> Product | None:
    """Load ``Product`` for a cart line whether ``product`` is a ``Link`` or an embedded document."""
    if not line.product:
        return None
    if isinstance(line.product, Link):
        loaded_product = await line.product.fetch()
        return loaded_product if isinstance(loaded_product, Product) else None
    if isinstance(line.product, Product):
        return line.product
    return None


async def _resolve_link_attachment_file_path(link_or_attachment: Any) -> str | None:
    """Return ``Attachment.file_path`` for a ``Link[Attachment]`` or loaded ``Attachment``."""
    if link_or_attachment is None:
        return None
    from backbone.domain.models import Attachment

    if isinstance(link_or_attachment, Link):
        loaded = await link_or_attachment.fetch()
        if isinstance(loaded, Attachment):
            return loaded.file_path
        return None
    if isinstance(link_or_attachment, Attachment):
        return link_or_attachment.file_path
    return None


async def _resolve_product_primary_image_path(product_document: Product | None) -> str | None:
    """Public media path for a product's ``primary_image`` attachment."""
    if not product_document:
        return None
    return await _resolve_link_attachment_file_path(getattr(product_document, "primary_image", None))


def _coerce_order_status_for_request_payload(raw_value: Any) -> OrderStatus:
    try:
        return parse_order_status(raw_value)
    except ValidationError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid order status. Allowed: {list(ORDER_STATUS_CHOICES)}",
        ) from None


def _coerce_payment_status_for_request_payload(raw_value: Any) -> PaymentStatus:
    try:
        return parse_payment_status(raw_value)
    except ValidationError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid payment_status. Allowed: {list(PAYMENT_STATUS_CHOICES)}",
        ) from None


class CategoryView(GenericCrudView):
    model = Category
    search_fields = ["name", "description"]
    filter_fields = ["name"]
    fetch_links = True
    permission_classes = [AllowAny]


class ProductView(GenericCrudView):
    model = Product
    search_fields = ["name", "tag", "description", "slug"]
    filter_fields = ["category_id", "tag", "stock", "is_published"]
    fetch_links = True
    permission_classes = [AllowAny]

    async def filter_queryset(self, base_query: dict[str, Any], request: Request) -> dict[str, Any]:
        """
        Public catalog defaults to published products only.
        Pass ``?is_published=false`` to include drafts (for admin-style tools).
        """
        query = await super().filter_queryset(base_query, request)
        if "is_published" not in request.query_params:
            query["is_published"] = True
        return query


class OrderView(GenericCrudView):
    model = Order
    search_fields = ["customer_name", "customer_email", "status", "payment_id"]
    filter_fields = ["customer_email", "status", "payment_status"]
    fetch_links = True
    permission_classes = [IsAuthenticated]

    async def filter_queryset(self, base_query: dict[str, Any], request: Request) -> dict[str, Any]:
        query = await super().filter_queryset(base_query, request)
        
        # ? Force scope to the logged-in user (Zero-Config Ownership)
        user = getattr(request.state, "user", None)
        if user:
             user_link = link_to_existing_document(User, str(user.id))
             # ? Double-match: find by account link OR by email (for guest recovery)
             query["$or"] = [
                 {"user": user_link},
                 {"customer_email": {"$regex": f"^{re.escape(user.email)}$", "$options": "i"}}
             ]
             # ? Clean up top-level email filter if it was passed in URL params
             query.pop("customer_email", None)

        elif "customer_email" in query and isinstance(query["customer_email"], str):
            email = query["customer_email"].lower().strip()
            query["customer_email"] = {"$regex": f"^{re.escape(email)}$", "$options": "i"}
            
        return query

    async def before_create(self, data: dict[str, Any], user: Any) -> dict[str, Any]:
        """
        Normalize statuses and build ``OrderItem`` snapshots either from a cart
        or from a raw ``items`` array for manual orders.
        """
        data["status"] = _coerce_order_status_for_request_payload(data.get("status", "pending"))
        data["payment_status"] = _coerce_payment_status_for_request_payload(
            data.get("payment_status", "pending"),
        )

        cart_id = data.get("cart_id")
        customer_payment_reference = data.pop("payment_id", None)

        processed_items: list[OrderItem] = []
        total_amount = 0.0

        if cart_id:
            cart = await Cart.get(cart_id)
            if not cart:
                raise HTTPException(status_code=404, detail="Cart not found.")
            
            # ? Check ownership via User link
            cart_owner_id = _extract_id_from_link(cart.user)
            if cart_owner_id and (
                user is None or str(getattr(user, "id", "")) != cart_owner_id
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You cannot place an order with another user's cart.",
                )
            # 1. Map links
            data["cart"] = link_to_existing_document(Cart, str(cart_id))
            if user:
                data["user"] = link_to_existing_document(User, str(user.id))
            
            # ? Capture screenshot for the payment record created later
            screenshot_id = data.pop("screenshot_id", None)
            if screenshot_id:
                data["_payment_screenshot_id"] = screenshot_id

            cart_items = await CartItem.find(
                CartItem.cart == link_to_existing_document(Cart, str(cart_id))
            ).to_list()
            if not cart_items:
                raise HTTPException(status_code=400, detail="Cart is empty.")

            for line in cart_items:
                product_document = await _resolve_product_for_cart_line(line)
                if not product_document:
                    continue

                unit_price = float(product_document.price_value or 0.0)
                quantity = int(line.quantity)

                if product_document.stock < quantity:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Insufficient stock for '{line.name}'. "
                            f"Only {product_document.stock} available."
                        ),
                    )

                cover_path = await _resolve_product_primary_image_path(product_document)
                snapshot_image = cover_path
                
                # ? Create and save OrderItem doc so it can be linked
                item_doc = OrderItem(
                    product=link_to_existing_document(Product, str(product_document.id)),
                    product_id=str(product_document.id),
                    cart_item_id=str(line.id),
                    name=line.name,
                    price=unit_price,
                    image=snapshot_image,
                    quantity=quantity,
                    subtotal=unit_price * quantity,
                )
                await item_doc.insert()
                processed_items.append(item_doc)
                total_amount += item_doc.subtotal

        else:
            raw_items = data.pop("items", [])
            if not raw_items:
                raise HTTPException(status_code=400, detail="Order must contain at least one item.")

            for raw_line in raw_items:
                product_id = _extract_product_id_from_payload(raw_line)
                if not product_id:
                    continue

                product_document = await Product.get(product_id, fetch_links=True)
                if not product_document:
                    raise HTTPException(status_code=404, detail=f"Product {product_id} not found.")

                quantity = (
                    raw_line.get("quantity", 1)
                    if isinstance(raw_line, dict)
                    else getattr(raw_line, "quantity", 1)
                )
                if product_document.stock < quantity:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for {product_document.name}.",
                    )

                unit_price = float(product_document.price_value or 0.0)
                cover_path = await _resolve_product_primary_image_path(product_document)
                
                item_doc = OrderItem(
                    product=link_to_existing_document(Product, str(product_document.id)),
                    product_id=str(product_document.id),
                    name=product_document.name,
                    price=unit_price,
                    image=cover_path,
                    quantity=quantity,
                    subtotal=unit_price * quantity,
                )
                await item_doc.insert()
                processed_items.append(item_doc)
                total_amount += item_doc.subtotal

        if not processed_items:
            raise HTTPException(
                status_code=400, detail="No valid items could be processed for this order."
            )

        data["items"] = [link_to_existing_document(OrderItem, str(item.id)) for item in processed_items]
        data["total_amount"] = total_amount
        data["payment_id"] = customer_payment_reference
        # ? UPI / txn reference submitted → ``received`` (awaiting staff ``verified`` / ``failed``).
        has_payment_reference = bool(
            (customer_payment_reference or "").strip() if isinstance(customer_payment_reference, str) else customer_payment_reference
        )
        data["payment_status"] = "received" if has_payment_reference else "pending"
        return data

    async def before_update(
        self, instance: Order, data: dict[str, Any], user: Any
    ) -> dict[str, Any]:
        if "status" in data:
            data["status"] = _coerce_order_status_for_request_payload(data["status"])
        if "payment_status" in data:
            data["payment_status"] = _coerce_payment_status_for_request_payload(
                data["payment_status"]
            )
        return data

    async def after_create(self, instance: Order, user: Any) -> Order:
        # ? Set back-links on OrderItems
        for item_link in instance.items:
            item_doc = await item_link.fetch()
            if item_doc:
                item_doc.order = link_to_existing_document(Order, str(instance.id))
                await item_doc.save()

        await self._decrement_product_stock_for_order(instance)
        await self._mark_source_cart_as_ordered(instance)
        await self._create_and_link_payment_record(instance)
        return instance

    async def _decrement_product_stock_for_order(self, order: Order) -> None:
        """Reduce stock for every product line after a confirmed order."""
        for item_link in order.items:
            line = await item_link.fetch()
            if not line or not line.product_id:
                continue
            product_document = await Product.get(line.product_id)
            if product_document:
                product_document.stock = max(0, product_document.stock - line.quantity)
                await product_document.save()

    async def _mark_source_cart_as_ordered(self, order: Order) -> None:
        """Flip ``is_ordered=True`` on the source cart so it is excluded from active carts."""
        source_cart_link = getattr(order, "cart", None)
        if not source_cart_link:
            return
        
        # ? order.cart is a Link[Cart], we need the document ID
        cart_id = _extract_id_from_link(source_cart_link)
        source_cart = await Cart.get(cart_id)
        if source_cart and not source_cart.is_ordered:
            source_cart.is_ordered = True
            await source_cart.save()

    async def _create_and_link_payment_record(self, order: Order) -> None:
        """Insert a Payment row and back-link it on the Order."""
        screenshot_link = None
        screenshot_id = getattr(order, "_payment_screenshot_id", None)
        if screenshot_id:
            screenshot_link = link_to_existing_document(Attachment, str(screenshot_id))

        payment_row = Payment(
            order=link_to_existing_document(Order, str(order.id)),
            user=order.user,  # ? Copy user link from order
            amount=order.total_amount,
            currency="INR",
            method="UPI",
            transaction_id=order.payment_id,
            screenshot=screenshot_link,
            status="pending",
            submitted_at=datetime.now(UTC) if order.payment_id else None,
        )
        await payment_row.insert()
        order.payment = link_to_existing_document(Payment, str(payment_row.id))
        await order.save()


class CartView(GenericCrudView):
    model = Cart
    # ? List scoping is enforced in ``get_queryset`` only — query params must not override ``user_id``.
    search_fields: ClassVar[list[str]] = []
    filter_fields: ClassVar[list[str]] = []
    fetch_links = True
    permission_classes = [IsAuthenticated]

    async def get_queryset(self, request: Request, user: Any) -> dict[str, Any]:
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )
        base_query = await super().get_queryset(request, user)
        # ? Query by User link
        user_link = link_to_existing_document(User, str(user.id))
        return {**base_query, "is_ordered": False, "user": user_link}

    async def get_object_by_lookup(self, lookup_value: str, request: Request, user: Any) -> Cart:
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )
        cart = await self.repository.get(lookup_value, fetch_links=self.fetch_links)
        if not cart:
            from backbone.core.exceptions import NotFoundException
            raise NotFoundException(f"{self.model.__name__} not found.")

        # ? Check ownership via User link
        cart_owner_id = _extract_id_from_link(cart.user)
        if not cart_owner_id or cart_owner_id != str(user.id):
            from backbone.core.exceptions import NotFoundException
            raise NotFoundException(f"{self.model.__name__} not found.")
        return cart

    async def _find_existing_open_cart(self, data: dict[str, Any]) -> Cart | None:
        """Return an active cart for the same logged-in user (idempotent create)."""
        user_link = data.get("user")
        if not user_link:
            return None
        
        find_filter: dict[str, Any] = {
            "is_ordered": False,
            "is_deleted": {"$ne": True},
            "user": user_link,
        }
        items, _total = await self.repository.list(
            find_filter,
            skip=0,
            limit=1,
            sort=None,
            fetch_links=False,
        )
        return items[0] if items else None

    async def perform_create(self, data: dict[str, Any]) -> Any:
        pending_line_payloads = data.pop("_pending_items", [])
        existing_cart = await self._find_existing_open_cart(data)
        if existing_cart is not None:
            setattr(existing_cart, "_pending_items", pending_line_payloads)
            return existing_cart
        try:
            new_cart = await super().perform_create(data)
        except DuplicateKeyError:
            existing_cart = await self._find_existing_open_cart(data)
            if existing_cart is None:
                raise
            setattr(existing_cart, "_pending_items", pending_line_payloads)
            return existing_cart
        setattr(new_cart, "_pending_items", pending_line_payloads)
        return new_cart

    async def _sync_cart_line_items(
        self,
        cart_id: str,
        raw_line_payloads: list[Any],
    ) -> tuple[list[CartItem], float]:
        """
        Synchronize ``CartItem`` collection with the incoming payload using a merge strategy.
        Preserves existing documents to maintain stable IDs.
        """
        # 1. Fetch existing items
        existing_items = await CartItem.find(
            CartItem.cart == link_to_existing_document(Cart, cart_id)
        ).to_list()
        existing_map = {
            _extract_id_from_link(item.product): item for item in existing_items
        }

        new_links: list[CartItem] = []
        total_amount = 0.0
        seen_product_ids: set[str] = set()

        # 2. Process payload
        for raw_line in raw_line_payloads:
            product_id = _extract_product_id_from_payload(raw_line)
            if not product_id or product_id in seen_product_ids:
                continue
            seen_product_ids.add(product_id)

            product_document = await Product.get(product_id, fetch_links=True)
            if not product_document:
                continue

            quantity = (
                raw_line.get("quantity", 1)
                if isinstance(raw_line, dict)
                else getattr(raw_line, "quantity", 1)
            )
            if product_id in existing_map:
                # ? Update existing document
                cart_line = existing_map.pop(product_id)
                cart_line.quantity = int(quantity)
                cart_line.name = product_document.name
                await cart_line.save()
            else:
                # ? Create new document
                cart_line = CartItem(
                    cart=link_to_existing_document(Cart, cart_id),
                    product=product_document,
                    name=product_document.name,
                    quantity=int(quantity),
                )
                await cart_line.insert()

            new_links.append(cart_line)
            total_amount += float(product_document.price_value or 0.0) * quantity

        # 3. Delete orphans
        for orphan in existing_map.values():
            await orphan.delete()

        return new_links, total_amount

    async def before_create(self, data: dict[str, Any], user: Any) -> dict[str, Any]:
        raw_items = data.pop("items", [])

        if user:
            data["user"] = link_to_existing_document(User, str(user.id))

        data["items"] = []
        data["total_amount"] = 0.0
        data["_pending_items"] = raw_items
        return data

    async def after_create(self, instance: Cart, user: Any) -> Cart:
        cart_id = str(instance.id)
        pending_line_payloads = getattr(instance, "_pending_items", [])

        if pending_line_payloads:
            processed_links, total_amount = await self._sync_cart_line_items(
                cart_id, pending_line_payloads
            )
            instance.items = cast(list[Link[CartItem]], processed_links)
            instance.total_amount = total_amount
            await instance.save()

        return instance

    async def before_update(
        self, instance: Cart, data: dict[str, Any], user: Any
    ) -> dict[str, Any]:
        # ? Verify ownership via link
        if user is not None:
            owner_id = _extract_id_from_link(instance.user)
            if owner_id != str(user.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You cannot modify another user's cart.",
                )
        if "items" in data:
            raw_items = data.pop("items", [])
            cart_id = str(getattr(instance, "id", "") or "")
            processed_links, total_amount = await self._sync_cart_line_items(cart_id, raw_items)
            data["items"] = cast(list[Link[CartItem]], processed_links)
            data["total_amount"] = total_amount
        return data


class PaymentView(GenericCrudView):
    model = Payment
    filter_fields = ["status", "method", "user"]
    fetch_links = True
    permission_classes = [AllowAny]

    async def before_create(self, data: dict[str, Any], user: Any) -> dict[str, Any]:
        if user and not data.get("user"):
            data["user"] = link_to_existing_document(User, str(user.id))
        
        # ? Handle screenshot mapping if passed as string ID by the frontend
        screenshot_id = data.pop("screenshot_id", None)
        if screenshot_id:
            data["screenshot"] = link_to_existing_document(Attachment, str(screenshot_id))
        
        return data


shop_router = APIRouter()

@shop_router.post("/upload-screenshot", tags=["Shop — Payments"])
async def upload_payment_screenshot(
    file: UploadFile = File(...),
    user: Any = Depends(get_current_user)
) -> dict[str, str]:
    """Public endpoint for customers to upload payment proof screenshots."""
    from backbone.web.routers.admin.helpers import save_uploaded_file_as_attachment
    attachment_id = await save_uploaded_file_as_attachment(file)
    return {"id": str(attachment_id)}

shop_router.include_router(CategoryView.as_router("/categories", tags=["Shop — Categories"]))
shop_router.include_router(ProductView.as_router("/products", tags=["Shop — Products"]))
shop_router.include_router(OrderView.as_router("/orders", tags=["Shop — Orders"]))
shop_router.include_router(CartView.as_router("/carts", tags=["Shop — Carts"]))
shop_router.include_router(PaymentView.as_router("/payments", tags=["Shop — Payments"]))

__all__ = ["shop_router"]
