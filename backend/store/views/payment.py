"""Payment and file-upload views."""
import logging
import uuid

from django.core.files.storage import default_storage
from rest_framework import permissions, status, views, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from ..models import Payment
from ..serializers import PaymentSerializer

logger = logging.getLogger(__name__)


class PaymentViewSet(viewsets.ModelViewSet):
    """Authenticated user can view and submit their own payments."""

    serializer_class   = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class UploadScreenshotView(views.APIView):
    """Accept a UPI screenshot upload and return a media URL."""

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, format=None):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'},
                            status=status.HTTP_400_BAD_REQUEST)

        filename = f"screenshots/{uuid.uuid4().hex}_{file_obj.name}"
        path     = default_storage.save(filename, file_obj)
        url      = f"/media/{path}"

        logger.info("screenshot_uploaded", extra={"url": url})
        return Response({'id': url, 'url': url}, status=status.HTTP_201_CREATED)
