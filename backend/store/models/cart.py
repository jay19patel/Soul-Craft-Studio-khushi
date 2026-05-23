from django.db import models
from django.contrib.auth.models import User
from .product import ProductVariant


class Cart(models.Model):
    """Shopping cart — can belong to a logged-in user or an anonymous session."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='carts')
    session_id = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        owner = self.user.username if self.user else f"session:{self.session_id}"
        return f"Cart [{owner}]"


class CartItem(models.Model):
    """A single line item inside a cart."""

    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    @property
    def total_price(self):
        price = self.variant.price_override or self.variant.product.base_price
        return price * self.quantity

    def __str__(self) -> str:
        return f"{self.quantity} × {self.variant.product.name}"
