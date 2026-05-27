from django.db import models
from django.contrib.auth.models import User
from .product import ProductVariant


class Order(models.Model):
    """A customer order with full status + payment lifecycle tracking."""

    STATUS_CHOICES = [
        ('PENDING',    'Pending'),
        ('PROCESSING', 'Processing'),
        ('SHIPPED',    'Shipped'),
        ('DELIVERED',  'Delivered'),
        ('CANCELLED',  'Cancelled'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('PENDING',  'Pending'),
        ('RECEIVED', 'Received'),
        ('VERIFIED', 'Verified'),
        ('FAILED',   'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')

    # Customer details (stored at order-time so they survive profile edits)
    customer_name  = models.CharField(max_length=255, null=True, blank=True)
    customer_email = models.EmailField(null=True, blank=True)
    customer_phone = models.CharField(max_length=20, null=True, blank=True)

    # Shipping
    shipping_address = models.TextField()
    city    = models.CharField(max_length=100, null=True, blank=True)
    state   = models.CharField(max_length=100, null=True, blank=True)
    pincode = models.CharField(max_length=20,  null=True, blank=True)

    # Status
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES,         default='PENDING')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    total_amount   = models.DecimalField(max_digits=10, decimal_places=2)

    # Payment tracking
    payment_reference   = models.CharField(max_length=40, unique=True, null=True, blank=True, editable=False)
    upi_transaction_id  = models.CharField(max_length=255, null=True, blank=True)
    screenshot_id       = models.CharField(max_length=255, null=True, blank=True)

    # Timeline
    created_at         = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)
    payment_verified_at = models.DateTimeField(null=True, blank=True)
    processing_at       = models.DateTimeField(null=True, blank=True)
    shipped_at          = models.DateTimeField(null=True, blank=True)
    delivered_at        = models.DateTimeField(null=True, blank=True)
    cancelled_at        = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs) -> None:
        from django.utils import timezone
        now = timezone.now()

        if self.pk:
            old = Order.objects.get(pk=self.pk)

            if old.status != self.status:
                if self.status == 'PROCESSING': self.processing_at = now
                elif self.status == 'SHIPPED':  self.shipped_at    = now
                elif self.status == 'DELIVERED': self.delivered_at = now
                elif self.status == 'CANCELLED': self.cancelled_at = now

            if old.payment_status != self.payment_status:
                if self.payment_status == 'VERIFIED':
                    self.payment_verified_at = now

        super().save(*args, **kwargs)

        if not self.payment_reference:
            self.payment_reference = f"PAY-SCS-{self.pk:06d}"
            Order.objects.filter(pk=self.pk).update(payment_reference=self.payment_reference)

    def __str__(self) -> str:
        return f"Order #{self.id} — {self.user.username}"


class OrderItem(models.Model):
    """One product line inside an order. Price is snapshot at purchase time."""

    order   = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True)
    quantity = models.PositiveIntegerField()
    price    = models.DecimalField(max_digits=10, decimal_places=2)  # locked at order time

    @property
    def total_price(self):
        return self.price * self.quantity

    def __str__(self) -> str:
        name = self.variant.product.name if self.variant else "Deleted Product"
        return f"{self.quantity} × {name}"
