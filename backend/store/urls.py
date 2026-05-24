from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, ProductViewSet, CartViewSet, OrderViewSet,
    PaymentViewSet, TestimonialViewSet, AddressViewSet, ContactViewSet,
    RegisterView, LoginView, MeView, LogoutView, GoogleLogin, UploadScreenshotView,
    AdminDashboardStatsView, AdminOrderViewSet, AdminProductViewSet,
    ContactMessageViewSet
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'carts', CartViewSet, basename='cart')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'testimonials', TestimonialViewSet, basename='testimonial')

router.register(r'addresses', AddressViewSet, basename='address')
router.register(r'contacts', ContactViewSet, basename='contact')
router.register(r'admin/orders', AdminOrderViewSet, basename='admin-order')
router.register(r'admin/products', AdminProductViewSet, basename='admin-product')
router.register(r'contact-messages', ContactMessageViewSet, basename='contact-message')

urlpatterns = [
    path('', include(router.urls)),
    path('upload-screenshot', UploadScreenshotView.as_view(), name='upload_screenshot'),
    path('admin/stats', AdminDashboardStatsView.as_view(), name='admin_stats'),
    # Auth endpoints mapped exactly as frontend expects them (/api/auth/login)
    path('auth/register', RegisterView.as_view(), name='register'),
    path('auth/login', LoginView.as_view(), name='login'),
    path('auth/me', MeView.as_view(), name='me'),
    path('auth/logout', LogoutView.as_view(), name='logout'),
    path('auth/google/', GoogleLogin.as_view(), name='google_login'),

    path("auth/", include("dj_rest_auth.urls")),
    path("auth/registration/", include("dj_rest_auth.registration.urls")),
]
