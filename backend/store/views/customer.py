"""Customer profile views: addresses, contacts, testimonials."""
import logging

from rest_framework import permissions, viewsets

from ..models import Address, Contact, Testimonial
from ..serializers import AddressSerializer, ContactSerializer, TestimonialSerializer

logger = logging.getLogger(__name__)


class AddressViewSet(viewsets.ModelViewSet):
    """Authenticated user's saved delivery addresses."""

    serializer_class   = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user).order_by('-is_default', '-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ContactViewSet(viewsets.ModelViewSet):
    """Authenticated user's saved phone numbers."""

    serializer_class   = ContactSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(user=self.request.user).order_by('-is_default', '-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TestimonialViewSet(viewsets.ReadOnlyModelViewSet):
    """Public read-only listing of active testimonials."""

    queryset           = Testimonial.objects.filter(is_active=True).order_by('-created_at')
    serializer_class   = TestimonialSerializer
    permission_classes = [permissions.AllowAny]
