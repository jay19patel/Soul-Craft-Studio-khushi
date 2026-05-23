"""Order views — customer-facing and admin."""
import logging

from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from ..models import Order, OrderItem, Payment, ProductVariant
from ..serializers import OrderSerializer

logger = logging.getLogger(__name__)


class OrderViewSet(viewsets.ModelViewSet):
    """Authenticated customer can list, view and create their own orders."""

    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """
        Create an order from a manual checkout payload (not from a cart).
        Sends order confirmation + PDF invoice email automatically.
        """
        data = request.data
        user = request.user if request.user.is_authenticated else None

        order = Order.objects.create(
            user             = user,
            customer_name    = data.get('customer_name'),
            customer_email   = data.get('customer_email'),
            customer_phone   = data.get('customer_phone'),
            shipping_address = data.get('shipping_address'),
            city             = data.get('city'),
            state            = data.get('state'),
            pincode          = data.get('pincode'),
            total_amount     = data.get('total_amount', 0),
            payment_id       = data.get('payment_id'),
            screenshot_id    = data.get('screenshot_id'),
            status           = data.get('status', 'PENDING'),
        )

        # Create order items
        for item in data.get('items', []):
            try:
                variant = ProductVariant.objects.filter(
                    product_id=item.get('product_id')
                ).first()
                if variant:
                    OrderItem.objects.create(
                        order    = order,
                        variant  = variant,
                        quantity = item.get('quantity', 1),
                        price    = item.get('price', 0),
                    )
            except (ValueError, TypeError):
                logger.warning("order_item_skipped",
                               extra={"order_id": order.id, "item": item})

        # Create payment record if provided
        if data.get('payment_id') or data.get('screenshot_id'):
            Payment.objects.create(
                user           = user,
                order          = order,
                amount         = data.get('total_amount', 0),
                screenshot_url = data.get('screenshot_id'),
                status         = 'VERIFIED' if data.get('payment_id') else 'PENDING',
            )

        # Fire confirmation email + PDF invoice
        from ..utils import send_order_confirmation_email
        send_order_confirmation_email(order)

        logger.info("order_created", extra={"order_id": order.id, "user_id": getattr(user, 'id', None)})
        return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminOrderViewSet(viewsets.ModelViewSet):
    """Admin full-access order management. All updates are automatically partial."""

    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset           = Order.objects.all().order_by('-created_at')

    def update(self, request, *args, **kwargs):
        """Force partial=True so admin can PATCH individual status fields."""
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)
