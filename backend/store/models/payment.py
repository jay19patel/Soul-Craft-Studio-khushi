from django.db import models
from django.contrib.auth.models import User
from .order import Order


class Payment(models.Model):
    """Payment record for UPI screenshot-based verification flow."""

    STATUS_CHOICES = [
        ('PENDING',  'Pending'),
        ('VERIFIED', 'Verified'),
        ('REJECTED', 'Rejected'),
    ]

    user   = models.ForeignKey(User,  on_delete=models.CASCADE, related_name='payments')
    order  = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments', null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_reference = models.CharField(max_length=40, null=True, blank=True)
    upi_transaction_id = models.CharField(max_length=255, null=True, blank=True)
    screenshot_url = models.URLField(blank=True, null=True)
    status = models.CharField(max_length=20, default='PENDING', choices=STATUS_CHOICES)

    submitted_at  = models.DateTimeField(auto_now_add=True)
    received_at   = models.DateTimeField(null=True, blank=True)
    confirmed_at  = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.order_id:
            self.payment_reference = self.payment_reference or self.order.payment_reference
            self.upi_transaction_id = self.upi_transaction_id or self.order.upi_transaction_id
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Payment #{self.id} — ₹{self.amount} [{self.status}]"
