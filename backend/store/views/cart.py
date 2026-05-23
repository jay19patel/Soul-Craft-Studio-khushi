"""Cart views — sync, add item, and checkout."""
import logging

from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Cart, CartItem, Order, OrderItem, ProductVariant
from ..serializers import CartSerializer, CartItemSerializer, OrderSerializer

logger = logging.getLogger(__name__)


class CartViewSet(viewsets.ModelViewSet):
    """Shopping cart CRUD + add-item action + checkout action."""

    serializer_class   = CartSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Cart.objects.filter(
                Q(user=self.request.user) | Q(user__isnull=True)
            ).order_by('-created_at')
        return Cart.objects.all().order_by('-created_at')

    # ── sync entire cart ──

    def update(self, request, *args, **kwargs):
        """Replace all cart items from a frontend-provided list (full sync)."""
        cart = self.get_object()

        # Claim anonymous cart on login
        if request.user.is_authenticated and cart.user is None:
            cart.user = request.user
            cart.save()

        cart.items.all().delete()

        for item_data in request.data.get('items', []):
            product_id = item_data.get('product')
            quantity   = item_data.get('quantity', 1)
            try:
                variant = ProductVariant.objects.filter(product_id=product_id).first()
                if variant:
                    CartItem.objects.create(cart=cart, variant=variant, quantity=quantity)
            except ValueError:
                logger.warning("cart_item_skipped_bad_product_id",
                               extra={"product_id": product_id})

        return Response(self.get_serializer(cart).data)

    # ── add single item ──

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Increment (or create) a cart item by variant_id."""
        cart       = self.get_object()
        variant_id = request.data.get('variant_id')
        quantity   = int(request.data.get('quantity', 1))

        if not variant_id:
            return Response({'error': 'variant_id is required'},
                            status=status.HTTP_400_BAD_REQUEST)

        item, created = CartItem.objects.get_or_create(
            cart=cart, variant_id=variant_id,
            defaults={'quantity': quantity}
        )
        if not created:
            item.quantity += quantity
            item.save()

        return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)

    # ── checkout ──

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def checkout(self, request, pk=None):
        """Convert a cart into a confirmed Order."""
        cart             = self.get_object()
        shipping_address = request.data.get('shipping_address')

        if not shipping_address:
            return Response({'error': 'shipping_address is required'},
                            status=status.HTTP_400_BAD_REQUEST)

        items = cart.items.all()
        if not items.exists():
            return Response({'error': 'Cart is empty'}, status=status.HTTP_400_BAD_REQUEST)

        total_amount = sum(item.total_price for item in items)
        order = Order.objects.create(
            user=request.user,
            total_amount=total_amount,
            shipping_address=shipping_address,
        )
        OrderItem.objects.bulk_create([
            OrderItem(
                order=order,
                variant=item.variant,
                quantity=item.quantity,
                price=item.variant.price_override or item.variant.product.base_price,
            )
            for item in items
        ])
        cart.items.all().delete()

        logger.info("cart_checkout_complete",
                    extra={"order_id": order.id, "user_id": request.user.id})
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
