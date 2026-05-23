from django.db import models
from django.contrib.auth.models import User


class Address(models.Model):
    """A saved delivery address for a user. One address can be default."""

    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    full_name    = models.CharField(max_length=255)
    address_line = models.TextField()
    city         = models.CharField(max_length=100)
    state        = models.CharField(max_length=100)
    pincode      = models.CharField(max_length=20)
    is_default   = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Addresses'

    def save(self, *args, **kwargs) -> None:
        if self.is_default:
            Address.objects.filter(user=self.user).update(is_default=False)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.full_name} — {self.city}"


class Contact(models.Model):
    """A saved phone number for a user. One number can be marked as default."""

    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contacts')
    phone_number = models.CharField(max_length=20)
    is_default   = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs) -> None:
        if self.is_default:
            Contact.objects.filter(user=self.user).update(is_default=False)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.phone_number
