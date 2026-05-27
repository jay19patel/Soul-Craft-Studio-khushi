"""Email creation utilities backed by the durable outgoing email queue."""
from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from ..models import EmailLog

logger = logging.getLogger(__name__)

FRONTEND_URL = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
BRAND_NAME = "Soul Craft Studio"


# ── Core sender ───────────────────────────────────────────────────────────────

def send_email_async(
    subject:    str,
    body_text:  str,
    body_html:  str,
    to_email:   str,
    attachments: list | None = None,
    email_type: str = EmailLog.EmailType.OTHER,
    user=None,
    order=None,
) -> EmailLog:
    """Create an outbox entry and enqueue delivery after the DB commit."""
    attachment = attachments[0] if attachments else ("", None, "")
    email_log = EmailLog.objects.create(
        email_type=email_type,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to_email=to_email,
        user=user,
        order=order,
        attachment_name=attachment[0],
        attachment_data=attachment[1],
        attachment_mimetype=attachment[2],
        backend=settings.EMAIL_BACKEND,
    )

    def _enqueue() -> None:
        try:
            from ..tasks import send_queued_email
            send_queued_email.delay(email_log.pk)
        except Exception as exc:
            email_log.status = EmailLog.Status.FAILED
            email_log.error_message = f"Could not enqueue email: {exc}"
            email_log.save(update_fields=["status", "error_message"])
            logger.exception("email_enqueue_failed", extra={"email_log_id": email_log.pk})

    transaction.on_commit(_enqueue)
    return email_log


# ── Individual email senders ──────────────────────────────────────────────────

def _invoice_attachment(order) -> list | None:
    """Build the invoice attachment included only with order confirmation."""
    try:
        from .pdf import generate_invoice_pdf
        return [(f"Soul-Craft-Studio-Invoice-{order.id}.pdf", generate_invoice_pdf(order), "application/pdf")]
    except Exception as exc:
        logger.exception("invoice_pdf_failed", extra={"order_id": order.id, "error": str(exc)})
        return None


def send_order_confirmation_email(order) -> None:
    """Order confirmed — includes a PDF invoice as attachment."""
    to_email = order.customer_email or (order.user.email if order.user else None)
    if not to_email:
        logger.warning("order_email_skipped", extra={"order_id": order.id, "reason": "no_email"})
        return

    subject      = f"Order Confirmed - Invoice #{order.id} | {BRAND_NAME}"
    html_content = render_to_string("emails/order_success.html",
                                    {"order": order, "frontend_url": FRONTEND_URL})

    send_email_async(
        subject, strip_tags(html_content), html_content, to_email, _invoice_attachment(order),
        email_type=EmailLog.EmailType.ORDER_CONFIRMATION,
        user=order.user,
        order=order,
    )


def send_welcome_email(user) -> None:
    """Welcome a newly registered user."""
    if not user.email:
        return

    subject      = f"Welcome to {BRAND_NAME} - Your account is ready"
    html_content = render_to_string("emails/welcome.html", {
        "user_name":    user.get_full_name() or user.first_name or user.username,
        "user_email":   user.email,
        "join_date":    user.date_joined.strftime("%B %d, %Y"),
        "frontend_url": FRONTEND_URL,
    })
    send_email_async(
        subject, strip_tags(html_content), html_content, user.email,
        email_type=EmailLog.EmailType.WELCOME,
        user=user,
    )


def send_order_status_email(order) -> None:
    """Notify the customer when the order status changes, without attachments."""
    to_email = order.customer_email or (order.user.email if order.user else None)
    if not to_email:
        return

    STATUS_CFG: dict[str, dict] = {
        "PROCESSING": {
            "subject":  f"Your Order #{order.id} is Being Prepared | {BRAND_NAME}",
            "icon":     "\U0001f6e0\ufe0f",
            "headline": "We're Preparing Your Order!",
            "message":  "Great news! Your order is now in processing. Our team is carefully preparing your items.",
            "color":    "#2563eb",
        },
        "SHIPPED": {
            "subject":  f"Your Order #{order.id} is On the Way | {BRAND_NAME}",
            "icon":     "\U0001f69a",
            "headline": "Your Order is Shipped!",
            "message":  "Your order has been dispatched and is on its way. Expected delivery in 3\u20135 business days.",
            "color":    "#7c3aed",
        },
        "DELIVERED": {
            "subject":  f"Order #{order.id} Delivered | {BRAND_NAME}",
            "icon":     "\u2705",
            "headline": "Order Delivered!",
            "message":  "Your order has been delivered! We hope you love your purchase. Don\u2019t forget to leave a review.",
            "color":    "#16a34a",
        },
        "CANCELLED": {
            "subject":  f"Order #{order.id} Cancelled | {BRAND_NAME}",
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
    send_email_async(
        cfg["subject"], strip_tags(html_content), html_content, to_email,
        email_type=EmailLog.EmailType.ORDER_STATUS,
        user=order.user,
        order=order,
    )


def send_payment_status_email(order) -> None:
    """Notify the customer when the payment status changes, without attachments."""
    to_email = order.customer_email or (order.user.email if order.user else None)
    if not to_email:
        return

    PAYMENT_CFG: dict[str, dict] = {
        "RECEIVED": {
            "subject":  f"Payment Received for Order #{order.id} | {BRAND_NAME}",
            "icon":     "\U0001f4e9",
            "headline": "Payment Screenshot Received!",
            "message":  "We\u2019ve received your payment screenshot. Our team will verify it shortly (usually within 1\u20132 hours).",
            "color":    "#2563eb",
        },
        "VERIFIED": {
            "subject":  f"Payment Verified - Order #{order.id} Confirmed | {BRAND_NAME}",
            "icon":     "\u2705",
            "headline": "Payment Verified!",
            "message":  "Your payment has been verified and confirmed. Your order is now being processed. Thank you!",
            "color":    "#16a34a",
        },
        "FAILED": {
            "subject":  f"Payment Issue for Order #{order.id} | {BRAND_NAME}",
            "icon":     "\u26a0\ufe0f",
            "headline": "Payment Could Not Be Verified",
            "message":  "We could not verify your payment. Please contact us or resubmit your payment screenshot.",
            "color":    "#dc2626",
        },
        "REJECTED": {
            "subject":  f"Payment Rejected for Order #{order.id} | {BRAND_NAME}",
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
    send_email_async(
        cfg["subject"], strip_tags(html_content), html_content, to_email,
        email_type=EmailLog.EmailType.PAYMENT_STATUS,
        user=order.user,
        order=order,
    )
