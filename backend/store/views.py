from rest_framework import viewsets, permissions, status, views, generics
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import (
    Category, Product, Cart, CartItem, Order, OrderItem, Payment, Testimonial,
    Address, Contact, ContactMessage
)
from .serializers import (
    CategorySerializer, ProductSerializer, CartSerializer, 
    CartItemSerializer, OrderSerializer, PaymentSerializer, TestimonialSerializer,
    AddressSerializer, ContactSerializer, ContactMessageSerializer
)
import uuid
from django.core.files.storage import default_storage
from rest_framework.parsers import MultiPartParser, FormParser

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows categories to be viewed.
    """
    queryset = Category.objects.filter(parent__isnull=True) # Top level categories
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows products to be viewed.
    """
    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

class CartViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Cart operations.
    """
    queryset = Cart.objects.all()
    serializer_class = CartSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        from django.db.models import Q
        if self.request.user.is_authenticated:
            return Cart.objects.filter(Q(user=self.request.user) | Q(user__isnull=True)).order_by('-created_at')
        return Cart.objects.all().order_by('-created_at')

    def update(self, request, *args, **kwargs):
        cart = self.get_object()
        
        if request.user.is_authenticated and cart.user is None:
            cart.user = request.user
            cart.save()
            
        items_data = request.data.get('items', [])
        
        # Clear existing items and recreate to match frontend sync
        cart.items.all().delete()
        
        from .models import ProductVariant
        for item_data in items_data:
            product_id = item_data.get('product')
            quantity = item_data.get('quantity', 1)
            
            try:
                variant = ProductVariant.objects.filter(product_id=product_id).first()
                if variant:
                    CartItem.objects.create(cart=cart, variant=variant, quantity=quantity)
            except ValueError:
                pass
                
        return Response(self.get_serializer(cart).data)

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        cart = self.get_object()
        variant_id = request.data.get('variant_id')
        quantity = request.data.get('quantity', 1)
        
        if not variant_id:
            return Response({'error': 'variant_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Basic implementation: add item or increment quantity
        item, created = CartItem.objects.get_or_create(
            cart=cart, variant_id=variant_id,
            defaults={'quantity': quantity}
        )
        if not created:
            item.quantity += int(quantity)
            item.save()

        serializer = CartItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def checkout(self, request, pk=None):
        cart = self.get_object()
        shipping_address = request.data.get('shipping_address')

        if not shipping_address:
            return Response({'error': 'shipping_address is required'}, status=status.HTTP_400_BAD_REQUEST)

        items = cart.items.all()
        if not items.exists():
            return Response({'error': 'Cart is empty'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate total amount
        total_amount = sum(item.total_price for item in items)

        # Create Order
        order = Order.objects.create(
            user=request.user,
            total_amount=total_amount,
            shipping_address=shipping_address
        )

        # Create OrderItems
        order_items = []
        for item in items:
            price = item.variant.price_override if item.variant.price_override else item.variant.product.base_price
            order_items.append(
                OrderItem(
                    order=order,
                    variant=item.variant,
                    quantity=item.quantity,
                    price=price
                )
            )
        OrderItem.objects.bulk_create(order_items)

        # Clear the cart after successful checkout
        cart.items.all().delete()
        
        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class OrderViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Orders.
    """
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        data = request.data
        user = request.user if request.user.is_authenticated else None
        
        # Create Order
        order = Order.objects.create(
            user=user,
            customer_name=data.get('customer_name'),
            customer_email=data.get('customer_email'),
            customer_phone=data.get('customer_phone'),
            shipping_address=data.get('shipping_address'),
            city=data.get('city'),
            state=data.get('state'),
            pincode=data.get('pincode'),
            total_amount=data.get('total_amount', 0),
            payment_id=data.get('payment_id'),
            screenshot_id=data.get('screenshot_id'),
            status=data.get('status', 'PENDING')
        )

        # Create OrderItems
        items = data.get('items', [])
        from .models import ProductVariant
        for item in items:
            try:
                variant = ProductVariant.objects.filter(product_id=item.get('product_id')).first()
                if variant:
                    OrderItem.objects.create(
                        order=order,
                        variant=variant,
                        quantity=item.get('quantity', 1),
                        price=item.get('price', 0)
                    )
            except ValueError:
                pass
                
        # Optional: create Payment
        payment_id = data.get('payment_id')
        if payment_id or data.get('screenshot_id'):
            Payment.objects.create(
                user=user,
                order=order,
                amount=data.get('total_amount', 0),
                screenshot_url=data.get('screenshot_id'),
                status='VERIFIED' if payment_id else 'PENDING'
            )
            
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class TestimonialViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Testimonial.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = TestimonialSerializer
    permission_classes = [permissions.AllowAny]

# Auth Views
class RegisterView(views.APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        name = request.data.get('name', '')
        
        if not email or not password:
            return Response({'detail': 'Email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(username=email).exists():
            return Response({'detail': 'Email already exists.'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.create_user(username=email, email=email, password=password, first_name=name)
        
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.first_name,
            },
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)

class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        user = authenticate(username=email, password=password)
        
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'full_name': user.first_name,
                    'is_superuser': user.is_superuser,
                },
                'token': str(refresh.access_token), # Frontend expects "token"
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            })
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # We can just return success, client handles token deletion
        return Response({'detail': 'Successfully logged out'}, status=status.HTTP_200_OK)

class MeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'email': user.email,
            'full_name': user.first_name,
            'is_superuser': user.is_superuser,
        })

    def put(self, request):
        user = request.user
        full_name = request.data.get('full_name')
        password = request.data.get('password')

        if full_name:
            user.first_name = full_name
        
        if password:
            user.set_password(password)

        user.save()

        return Response({
            'id': user.id,
            'email': user.email,
            'full_name': user.first_name,
            'is_superuser': user.is_superuser,
        })

class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user).order_by('-is_default', '-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ContactViewSet(viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(user=self.request.user).order_by('-is_default', '-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class UploadScreenshotView(views.APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, format=None):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Save file to media directory
        filename = f"screenshots/{uuid.uuid4().hex}_{file_obj.name}"
        path = default_storage.save(filename, file_obj)
        url = default_storage.url(path)
        
        return Response({'id': url, 'url': url}, status=status.HTTP_201_CREATED)

class AdminDashboardStatsView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        total_products = Product.objects.count()
        total_orders = Order.objects.count()
        pending_orders = Order.objects.filter(status='PENDING').count()
        
        # Calculate total revenue
        from django.db.models import Sum, Count, Q
        from django.db.models.functions import TruncDate
        from django.utils import timezone
        from datetime import timedelta

        revenue_dict = Order.objects.filter(payment_status='VERIFIED').aggregate(Sum('total_amount'))
        total_revenue = revenue_dict.get('total_amount__sum') or 0

        # Chart Data: Last 7 Days
        seven_days_ago = timezone.now() - timedelta(days=7)
        daily_stats = (
            Order.objects.filter(created_at__gte=seven_days_ago)
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(
                revenue=Sum('total_amount', filter=Q(payment_status='VERIFIED')),
                orders=Count('id')
            )
            .order_by('date')
        )

        chart_data = []
        for stat in daily_stats:
            chart_data.append({
                'date': stat['date'].strftime('%d %b'),
                'revenue': float(stat['revenue'] or 0),
                'orders': stat['orders']
            })

        total_messages = ContactMessage.objects.count()
        unread_messages = ContactMessage.objects.filter(is_read=False).count()

        return Response({
            'total_products': total_products,
            'total_orders': total_orders,
            'pending_orders': pending_orders,
            'total_revenue': float(total_revenue),
            'chart_data': chart_data,
            'total_messages': total_messages,
            'unread_messages': unread_messages,
            'read_messages': total_messages - unread_messages,
        })
class ContactMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ContactMessageSerializer
    queryset = ContactMessage.objects.all().order_by('-created_at')

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class AdminProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = Product.objects.all().order_by('-created_at')

    def save_image(self, product, file_obj):
        if file_obj:
            filename = f"products/{uuid.uuid4().hex}_{file_obj.name}"
            path = default_storage.save(filename, file_obj)
            url = default_storage.url(path)
            
            # Create or update the primary product image
            from .models import ProductImage
            ProductImage.objects.filter(product=product).delete() # Simple replace for now
            ProductImage.objects.create(product=product, image_url=url, is_primary=True)

    def _get_mutable_data(self, request):
        if hasattr(request.data, 'dict'):
            return request.data.dict()
        return request.data.copy()

    def create(self, request, *args, **kwargs):
        data = self._get_mutable_data(request)
        if 'price' in data and 'base_price' not in data:
            data['base_price'] = data['price']
            
        if 'category_id' not in data or not data['category_id']:
            from .models import Category
            cat = Category.objects.first()
            if cat:
                data['category_id'] = cat.id
            
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Handle Image
        file_obj = request.FILES.get('image')
        self.save_image(serializer.instance, file_obj)
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        data = self._get_mutable_data(request)
        if 'price' in data and 'base_price' not in data:
            data['base_price'] = data['price']
            
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Handle Image
        file_obj = request.FILES.get('image')
        if file_obj:
            self.save_image(instance, file_obj)
            
        return Response(serializer.data)

class AdminOrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = Order.objects.all().order_by('-created_at')

    def update(self, request, *args, **kwargs):
        # Override update to handle partial status updates easily
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client
    # The callback_url must exactly match the frontend URL used to fetch the code if using auth-code flow.
    # We are using "postmessage" for the @react-oauth/google standard popup flow.
    callback_url = "postmessage"

