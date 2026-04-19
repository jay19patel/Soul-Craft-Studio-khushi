"""
* ecommerce/__init__.py
? Demo e-commerce domain (catalog, cart, checkout) plus simple content models.
"""

from ecommerce.models import (
    FAQ,
    Cart,
    CartItem,
    Category,
    Contact,
    Order,
    OrderItem,
    Payment,
    Product,
    Testimonial,
)

ECOMMERCE_DOCUMENT_MODELS = [
    Category,
    Product,
    CartItem,
    Cart,
    OrderItem,
    Order,
    Payment,
    FAQ,
    Testimonial,
    Contact,
]

__all__ = [
    "ECOMMERCE_DOCUMENT_MODELS",
    "Cart",
    "CartItem",
    "Category",
    "Contact",
    "FAQ",
    "Order",
    "Payment",
    "Product",
    "Testimonial",
]
