"""
* backbone/services/mail.py
? SMTP email service with Jinja2 template rendering.

  Template resolution (first match wins), same idea as the admin UI:

  1. ``<cwd>/templates/email/<name>.html`` — your application overrides
  2. ``backbone/templates/email/<name>.html`` — defaults shipped with Backbone

  Example: to customize the welcome message, add
  ``templates/email/welcome.html`` at the project root (same filename as the
  built-in). ``send_welcome_email`` loads ``welcome.html``; your file replaces
  the package default without changing Python code.
"""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, make_msgid
from pathlib import Path
from typing import Any

from jinja2 import ChoiceLoader, Environment, FileSystemLoader, select_autoescape

from backbone.config import BackboneSettings
from backbone.config import settings as default_settings

logger = logging.getLogger("backbone.services.mail")


class MailService:
    """
    Renders Jinja2 email templates and dispatches them via SMTP.

    Template resolution order:
      1. <cwd>/templates/email/
      2. backbone/templates/email/  (built-in defaults shipped with the library)
    """

    def __init__(self, app_settings: BackboneSettings | None = None) -> None:
        self._settings = app_settings or default_settings
        self._jinja_env = self._build_jinja_environment()

    # ── Jinja2 Setup ───────────────────────────────────────────────────────

    def _build_jinja_environment(self) -> Environment:
        template_search_paths = self._collect_template_search_paths()
        loader = ChoiceLoader(
            [FileSystemLoader(str(p)) for p in template_search_paths if p.exists()]
        )
        return Environment(loader=loader, autoescape=select_autoescape(["html", "xml"]))

    def _collect_template_search_paths(self) -> list[Path]:
        """Return ordered template search paths: user paths before built-ins."""
        user_email_templates = self._settings.user_templates_path / "email"
        backbone_email_templates = self._settings.backbone_templates_path / "email"
        return [user_email_templates, backbone_email_templates]

    # ── Template Rendering ─────────────────────────────────────────────────

    def render_template(self, template_name: str, context: dict[str, Any]) -> str:
        template = self._jinja_env.get_template(template_name)
        return template.render(**context)

    # ── Email Sending ──────────────────────────────────────────────────────

    async def send_email(
        self,
        to_email: str,
        subject: str,
        template_name: str | None = None,
        context: dict[str, Any] | None = None,
        html_body: str | None = None,
    ) -> None:
        """
        Send an HTML email.
        Provide either template_name + context, or a raw html_body.
        """
        if not self._settings.EMAIL_ENABLED:
            logger.info(
                "Email is disabled. Skipping delivery to %s — subject: %s",
                to_email,
                subject,
            )
            return

        html_content = self._resolve_email_html_content(template_name, context, html_body)
        message = self._build_mime_message(to_email, subject, html_content)
        await asyncio.to_thread(self._deliver_via_smtp, message)
        logger.info("Email delivered to %s — subject: %s", to_email, subject)

    def _resolve_email_html_content(
        self,
        template_name: str | None,
        context: dict[str, Any] | None,
        html_body: str | None,
    ) -> str:
        if template_name:
            return self.render_template(template_name, context or {})
        return html_body or ""

    def _build_mime_message(
        self,
        to_email: str,
        subject: str,
        html_content: str,
    ) -> MIMEMultipart:
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = formataddr(
            (self._settings.EMAIL_FROM_NAME, self._settings.EMAIL_FROM_ADDRESS)
        )
        message["To"] = to_email
        message["Message-ID"] = make_msgid()
        message.attach(MIMEText(html_content, "html"))
        return message

    def _deliver_via_smtp(self, message: MIMEMultipart) -> None:
        with smtplib.SMTP(self._settings.EMAIL_HOST, self._settings.EMAIL_PORT) as smtp_server:
            if self._settings.EMAIL_USE_TLS:
                smtp_server.starttls()
            if self._settings.EMAIL_USERNAME and self._settings.EMAIL_PASSWORD:
                smtp_server.login(self._settings.EMAIL_USERNAME, self._settings.EMAIL_PASSWORD)
            smtp_server.send_message(message)

    # ── High-Level Convenience Methods ─────────────────────────────────────

    async def send_welcome_email(self, to_email: str, full_name: str) -> None:
        await self.send_email(
            to_email=to_email,
            subject=f"Welcome to {self._settings.APP_NAME}!",
            template_name="welcome.html",
            context={
                "full_name": full_name,
                "app_name": self._settings.APP_NAME,
                "app_url": self._settings.APP_URL,
            },
        )

    async def send_email_verification(
        self,
        to_email: str,
        full_name: str,
        verification_token: str,
    ) -> None:
        verification_url = f"{self._settings.APP_URL}/pages/verify-email?token={verification_token}"
        await self.send_email(
            to_email=to_email,
            subject=f"Verify your email — {self._settings.APP_NAME}",
            template_name="verify_email.html",
            context={
                "full_name": full_name,
                "verification_url": verification_url,
                "app_name": self._settings.APP_NAME,
            },
        )

    async def send_password_reset_email(
        self,
        to_email: str,
        full_name: str,
        reset_token: str,
    ) -> None:
        reset_url = f"{self._settings.APP_URL}/pages/reset-password/confirm?token={reset_token}"
        await self.send_email(
            to_email=to_email,
            subject=f"Reset your password — {self._settings.APP_NAME}",
            template_name="password_reset.html",
            context={
                "full_name": full_name,
                "reset_url": reset_url,
                "app_name": self._settings.APP_NAME,
            },
        )

    async def send_order_confirmation_email(self, to_email: str, order: Any) -> None:
        """Send an order confirmation / receipt email after a new order is placed."""
        from datetime import datetime as _dt

        await self.send_email(
            to_email=to_email,
            subject=f"Order Confirmed – {self._settings.APP_NAME}",
            template_name="order_confirmation.html",
            context={
                "order": order,
                "order_id": str(order.id),
                "site_name": self._settings.APP_NAME,
                "app_url": self._settings.APP_URL,
                "current_year": _dt.now().year,
            },
        )

    async def send_order_status_update_email(
        self, to_email: str, order: Any, new_status: str
    ) -> None:
        """Send a notification when an order's fulfillment status changes."""
        from datetime import datetime as _dt

        await self.send_email(
            to_email=to_email,
            subject=f"Order Update: {new_status.replace('_', ' ').title()} – {self._settings.APP_NAME}",
            template_name="order_status_update.html",
            context={
                "order": order,
                "order_id": str(order.id),
                "new_status": new_status.replace("_", " ").title(),
                "site_name": self._settings.APP_NAME,
                "app_url": self._settings.APP_URL,
                "current_year": _dt.now().year,
            },
        )


# ? Module-level singleton (uses global settings)
mail_service = MailService()
