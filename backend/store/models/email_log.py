from django.conf import settings
from django.db import models


class EmailLog(models.Model):
    """Durable outgoing email queue item and delivery audit record."""

    class Status(models.TextChoices):
        QUEUED = "QUEUED", "Queued"
        SENDING = "SENDING", "Sending"
        RETRYING = "RETRYING", "Retrying"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"

    class EmailType(models.TextChoices):
        WELCOME = "WELCOME", "Welcome"
        ORDER_CONFIRMATION = "ORDER_CONFIRMATION", "Order confirmation"
        ORDER_STATUS = "ORDER_STATUS", "Order status"
        PAYMENT_STATUS = "PAYMENT_STATUS", "Payment status"
        OTHER = "OTHER", "Other"

    email_type = models.CharField(max_length=30, choices=EmailType.choices, default=EmailType.OTHER)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.QUEUED, db_index=True)
    subject = models.CharField(max_length=255)
    from_email = models.CharField(max_length=255)
    to_email = models.EmailField()
    body_text = models.TextField()
    body_html = models.TextField(blank=True)
    backend = models.CharField(max_length=255, blank=True)

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    order = models.ForeignKey("store.Order", null=True, blank=True, on_delete=models.SET_NULL)

    attachment_name = models.CharField(max_length=255, blank=True)
    attachment_mimetype = models.CharField(max_length=100, blank=True)
    attachment_data = models.BinaryField(null=True, blank=True, editable=False)

    attempts = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    queued_at = models.DateTimeField(auto_now_add=True)
    sending_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-queued_at"]

    def __str__(self) -> str:
        return f"{self.to_email} - {self.subject} ({self.status})"
