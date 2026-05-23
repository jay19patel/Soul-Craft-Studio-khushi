"""Email sending utilities — async delivery + all notification senders."""
from __future__ import annotations

import logging
import threading

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

FRONTEND_URL = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')


# ── Core sender ───────────────────────────────────────────────────────────────

def send_email_async(
    subject:    str,
    body_text:  str,
    body_html:  str,
    to_email:   str,
    attachments: list | None = None,
) -> None:
    """Send an email in a background thread so the API response is not blocked."""

    def _send() -> None:
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=body_text,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[to_email],
            )
            msg.attach_alternative(body_html, "text/html")
            if attachments:
                for filename, data, mimetype in attachments:
                    msg.attach(filename, data, mimetype)
            msg.send(fail_silently=False)
            logger.info("email_sent", extra={"to": to_email, "subject": subject})
        except Exception as exc:
            logger.error("email_send_failed", extra={"to": to_email, "error": str(exc)})

    threading.Thread(target=_send, daemon=True).start()


# ── Individual email senders ──────────────────────────────────────────────────

def send_order_confirmation_email(order) -> None:
    """Order confirmed — includes a PDF invoice as attachment."""
    to_email = order.customer_email or (order.user.email if order.user else None)
    if not to_email:
        logger.warning("order_email_skipped", extra={"order_id": order.id, "reason": "no_email"})
        return

    subject      = f"Order Confirmed \U0001f389 \u2014 Invoice #{order.id} | Khusi"
    html_content = render_to_string("emails/order_success.html",
                                    {"order": order, "frontend_url": FRONTEND_URL})

    attachments = None
    try:
        from .pdf import generate_invoice_pdf
        pdf_bytes   = generate_invoice_pdf(order)
        attachments = [(f"Khusi-Invoice-{order.id}.pdf", pdf_bytes, "application/pdf")]
    except Exception as exc:
        logger.error("invoice_pdf_failed", extra={"order_id": order.id, "error": str(exc)})

    send_email_async(subject, strip_tags(html_content), html_content, to_email, attachments)


def send_welcome_email(user) -> None:
    """Welcome a newly registered user."""
    if not user.email:
        return

    subject      = "Welcome to Khusi! \U0001f38a Your account is ready"
    html_content = render_to_string("emails/welcome.html", {
        "user_name":    user.get_full_name() or user.first_name or user.username,
        "user_email":   user.email,
        "join_date":    user.date_joined.strftime("%B %d, %Y"),
        "frontend_url": FRONTEND_URL,
    })
    send_email_async(subject, strip_tags(html_content), html_content, user.email)


def send_order_status_email(order) -> None:
    """Notify the customer when the order status changes."""
    to_email = order.customer_email or (order.user.email if order.user else None)
    if not to_email:
        return

    STATUS_CFG: dict[str, dict] = {
        "PROCESSING": {
            "subject":  f"Your Order #{order.id} is Being Prepared \U0001f6e0\ufe0f | Khusi",
            "icon":     "\U0001f6e0\ufe0f",
            "headline": "We're Preparing Your Order!",
            "message":  "Great news! Your order is now in processing. Our team is carefully preparing your items.",
            "color":    "#2563eb",
        },
        "SHIPPED": {
            "subject":  f"Your Order #{order.id} is On the Way! \U0001f69a | Khusi",
            "icon":     "\U0001f69a",
            "headline": "Your Order is Shipped!",
            "message":  "Your order has been dispatched and is on its way. Expected delivery in 3\u20135 business days.",
            "color":    "#7c3aed",
        },
        "DELIVERED": {
            "subject":  f"Order #{order.id} Delivered \u2705 | Khusi",
            "icon":     "\u2705",
            "headline": "Order Delivered!",
            "message":  "Your order has been delivered! We hope you love your purchase. Don\u2019t forget to leave a review.",
            "color":    "#16a34a",
        },
        "CANCELLED": {
            "subject":  f"Order #{order.id} Cancelled | Khusi",
            "icon":     "\u274c",
            "headline": "Order Cancelled",
            "message":  "Your order has been cancelled. If you did not request this, please contact us immediately.",
            "color":    "#dc2626",
        },
    }

    cfg = STATUS_CFG.get(order.status)
    if not cfg:
        return

    context = {
        "order": order, "frontend_url": FRONTEND_URL,
        "icon": cfg["icon"], "headline": cfg["headline"],
        "message": cfg["message"], "color": cfg["color"],
        "status_display": order.get_status_display(),
    }
    html_content = render_to_string("emails/order_status_update.html", context)
    send_email_async(cfg["subject"], strip_tags(html_content), html_content, to_email)


def send_payment_status_email(order) -> None:
    """Notify the customer when the payment status changes."""
    to_email = order.customer_email or (order.user.email if order.user else None)
    if not to_email:
        return

    PAYMENT_CFG: dict[str, dict] = {
        "RECEIVED": {
            "subject":  f"Payment Received for Order #{order.id} \U0001f4e9 | Khusi",
            "icon":     "\U0001f4e9",
            "headline": "Payment Screenshot Received!",
            "message":  "We\u2019ve received your payment screenshot. Our team will verify it shortly (usually within 1\u20132 hours).",
            "color":    "#2563eb",
        },
        "VERIFIED": {
            "subject":  f"Payment Verified \u2705 \u2014 Order #{order.id} Confirmed | Khusi",
            "icon":     "\u2705",
            "headline": "Payment Verified!",
            "message":  "Your payment has been verified and confirmed. Your order is now being processed. Thank you!",
            "color":    "#16a34a",
        },
        "FAILED": {
            "subject":  f"Payment Issue for Order #{order.id} \u26a0\ufe0f | Khusi",
            "icon":     "\u26a0\ufe0f",
            "headline": "Payment Could Not Be Verified",
            "message":  "We could not verify your payment. Please contact us or resubmit your payment screenshot.",
            "color":    "#dc2626",
        },
        "REJECTED": {
            "subject":  f"Payment Rejected for Order #{order.id} | Khusi",
            "icon":     "\u274c",
            "headline": "Payment Rejected",
            "message":  "Unfortunately your payment was rejected. Please contact support or place a new order.",
            "color":    "#dc2626",
        },
    }

    cfg = PAYMENT_CFG.get(order.payment_status)
    if not cfg:
        return

    context = {
        "order": order, "frontend_url": FRONTEND_URL,
        "icon": cfg["icon"], "headline": cfg["headline"],
        "message": cfg["message"], "color": cfg["color"],
    }
    html_content = render_to_string("emails/payment_status_update.html", context)
    send_email_async(cfg["subject"], strip_tags(html_content), html_content, to_email)
