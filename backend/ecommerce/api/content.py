"""
* ecommerce/api/content.py
? Public CRUD endpoints for marketing content: FAQs, testimonials, contact form.
"""

from fastapi import APIRouter

from backbone import AllowAny, GenericCrudView
from ecommerce.models import FAQ, Contact, Testimonial


class FAQView(GenericCrudView):
    model = FAQ
    search_fields = ["question", "answer"]
    permission_classes = [AllowAny]


class TestimonialView(GenericCrudView):
    model = Testimonial
    search_fields = ["content", "author_name"]
    fetch_links = True
    permission_classes = [AllowAny]


class ContactView(GenericCrudView):
    model = Contact
    search_fields = ["name", "email", "subject"]
    permission_classes = [AllowAny]


content_router = APIRouter()
content_router.include_router(ContactView.as_router("/content/contact", tags=["Contact"]))
content_router.include_router(FAQView.as_router("/faqs", tags=["FAQs"]))
content_router.include_router(TestimonialView.as_router("/testimonials", tags=["Testimonials"]))

__all__ = ["content_router"]
