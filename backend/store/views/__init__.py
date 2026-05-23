"""
store.views package
===================
Re-exports every view class so that urls.py imports stay unchanged.
"""

from .auth     import RegisterView, LoginView, LogoutView, MeView, GoogleLogin
from .product  import CategoryViewSet, ProductViewSet, AdminProductViewSet
from .cart     import CartViewSet
from .order    import OrderViewSet, AdminOrderViewSet
from .payment  import PaymentViewSet, UploadScreenshotView
from .customer import AddressViewSet, ContactViewSet, TestimonialViewSet
from .admin    import AdminDashboardStatsView, ContactMessageViewSet

__all__ = [
    "RegisterView", "LoginView", "LogoutView", "MeView", "GoogleLogin",
    "CategoryViewSet", "ProductViewSet", "AdminProductViewSet",
    "CartViewSet",
    "OrderViewSet", "AdminOrderViewSet",
    "PaymentViewSet", "UploadScreenshotView",
    "AddressViewSet", "ContactViewSet", "TestimonialViewSet",
    "AdminDashboardStatsView", "ContactMessageViewSet",
]
