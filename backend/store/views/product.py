"""Product and Category views (public read + admin write)."""
import logging
import uuid

from django.core.files.storage import default_storage
from rest_framework import permissions, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from ..models import Category, Product, ProductImage
from ..serializers import CategorySerializer, ProductSerializer

logger = logging.getLogger(__name__)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Public read-only API for top-level product categories (with nested children)."""

    queryset = Category.objects.filter(parent__isnull=True).order_by('name', 'id')
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Public read-only API for active products."""

    queryset = Product.objects.filter(is_active=True).order_by('-created_at', '-id')
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminProductViewSet(viewsets.ModelViewSet):
    """Admin-only full CRUD for products, including image upload via multipart."""

    serializer_class   = ProductSerializer
    permission_classes = [permissions.IsAdminUser]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    queryset           = Product.objects.all().order_by('-created_at')

    # ── helpers ──

    def _get_mutable_data(self, request) -> dict:
        """Return a plain mutable dict from request.data (handles QueryDict + JSON)."""
        return request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)

    def _save_image(self, product: Product, file_obj) -> None:
        """Upload an image file and set it as the product's primary image."""
        if not file_obj:
            return
        filename = f"products/{uuid.uuid4().hex}_{file_obj.name}"
        path = default_storage.save(filename, file_obj)
        url  = f"/media/{path}"

        ProductImage.objects.filter(product=product).delete()
        ProductImage.objects.create(product=product, image_url=url, is_primary=True)
        logger.info("product_image_saved", extra={"product_id": product.id, "url": url})

    # ── overrides ──

    def create(self, request, *args, **kwargs):
        data = self._get_mutable_data(request)

        # Allow 'price' as alias for 'base_price'
        if 'price' in data and 'base_price' not in data:
            data['base_price'] = data['price']

        # Fall back to first category if none supplied
        if not data.get('category_id'):
            first_cat = Category.objects.first()
            if first_cat:
                data['category_id'] = first_cat.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        self._save_image(serializer.instance, request.FILES.get('image'))

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop('partial', False)
        instance = self.get_object()
        data     = self._get_mutable_data(request)

        if 'price' in data and 'base_price' not in data:
            data['base_price'] = data['price']

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        self._save_image(instance, request.FILES.get('image'))

        return Response(serializer.data)
