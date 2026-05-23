from django.db import models


class Testimonial(models.Model):
    """A customer testimonial / review displayed on the storefront."""

    name       = models.CharField(max_length=255)
    role       = models.CharField(max_length=255, blank=True)
    content    = models.TextField()
    rating     = models.PositiveIntegerField(default=5)
    image_url  = models.URLField(blank=True, null=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Testimonial from {self.name}"


class ContactMessage(models.Model):
    """An inbound message submitted via the contact form."""

    name       = models.CharField(max_length=255)
    email      = models.EmailField()
    subject    = models.CharField(max_length=255)
    message    = models.TextField()
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Message from {self.name} — {self.subject}"
