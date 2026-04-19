"""
* backbone/web/routers/pages.py
? Public HTML page routes: email verification, password reset flows, user guide.
"""

import logging
import os

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from jinja2 import ChoiceLoader, FileSystemLoader

from backbone.admin.site import admin_site
from backbone.config import settings

logger = logging.getLogger("backbone.web.routers.pages")

router = APIRouter(prefix="/pages", tags=["Pages"])


def register_framework_pages_in_admin_sidebar() -> None:
    """
    Register public HTML routes in the admin sidebar (Pages section).
    Call once from setup_backbone after admin_site is ready.
    """
    admin_site.register_page(
        name="User Guide",
        path="/pages/user-guide",
        methods=["GET"],
        description="Framework overview and API usage",
        category="Framework Pages",
    )
    admin_site.register_page(
        name="Verify Email",
        path="/pages/verify-email",
        methods=["GET"],
        description="Email verification landing page",
        category="Auth Pages",
    )
    admin_site.register_page(
        name="Reset Password",
        path="/pages/reset-password",
        methods=["GET", "POST"],
        description="Request a password reset link",
        category="Auth Pages",
    )
    admin_site.register_page(
        name="Reset Password (Confirm)",
        path="/pages/reset-password/confirm",
        methods=["GET", "POST"],
        description="Set a new password with token",
        category="Auth Pages",
    )


# ── Template Setup ─────────────────────────────────────────────────────────


def _build_pages_templates() -> Jinja2Templates:
    """
    Jinja2 ``ChoiceLoader`` search order:

      1. ``<cwd>/templates/`` — your application overrides (e.g. ``pages/user_guide.html``)
      2. ``backbone/templates/`` — packaged defaults shipped with the library
    """
    user_pages_path = settings.user_templates_path
    backbone_pages_path = settings.backbone_templates_path
    search_paths = [
        p for p in (str(user_pages_path), str(backbone_pages_path)) if os.path.exists(p)
    ]
    loader = ChoiceLoader([FileSystemLoader(p) for p in search_paths])
    templates_obj = Jinja2Templates(
        directory=search_paths[0] if search_paths else str(user_pages_path)
    )
    templates_obj.env.loader = loader
    return templates_obj


templates = _build_pages_templates()


# ── Email Verification ─────────────────────────────────────────────────────


@router.get("/verify-email", response_class=HTMLResponse, name="email_verify_page")
async def email_verification_status_page(
    request: Request,
    token: str = "",
    success: str = "false",
    reason: str = "",
):
    """Landing page after clicking the verification link in the email."""
    return templates.TemplateResponse(
        request,
        "pages/auth/verify_email_status.html",
        {
            "token": token,
            "success": success.lower() == "true",
            "reason": reason,
        },
    )


# ── Password Reset ─────────────────────────────────────────────────────────


@router.get("/reset-password", response_class=HTMLResponse, name="password_reset_request_page")
async def password_reset_request_page(request: Request):
    return templates.TemplateResponse(
        request,
        "pages/auth/reset_password_request.html",
        {
            "submitted": False,
        },
    )


@router.post("/reset-password", response_class=HTMLResponse)
async def handle_password_reset_request(request: Request, email: str = Form(...)):
    from backbone.services.auth import AuthService
    from backbone.services.mail import MailService

    auth_service = AuthService()
    mail_service = MailService()

    reset_token = await auth_service.generate_password_reset_token(email)
    request_was_successful = reset_token is not None

    if reset_token:
        user = await auth_service.find_user_by_email(email)
        try:
            await mail_service.send_password_reset_email(
                to_email=email,
                full_name=user.full_name if user else "User",
                reset_token=reset_token,
            )
        except Exception as exc:
            logger.error("Failed to send password reset email: %s", exc)

    return templates.TemplateResponse(
        request,
        "pages/auth/reset_password_request.html",
        {
            "submitted": True,
            "success": request_was_successful,
            "submitted_email": email,
        },
    )


@router.get(
    "/reset-password/confirm", response_class=HTMLResponse, name="password_reset_confirm_page"
)
async def password_reset_confirm_page(request: Request, token: str = ""):
    return templates.TemplateResponse(
        request,
        "pages/auth/reset_password_confirm.html",
        {
            "token": token,
            "submitted": False,
        },
    )


@router.post("/reset-password/confirm", response_class=HTMLResponse)
async def handle_password_reset_confirm(
    request: Request,
    token: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
):
    if password != confirm_password:
        return templates.TemplateResponse(
            request,
            "pages/auth/reset_password_confirm.html",
            {
                "token": token,
                "submitted": True,
                "error": "Passwords do not match.",
            },
        )

    from backbone.services.auth import AuthService

    auth_service = AuthService()
    reset_succeeded = await auth_service.reset_password_with_token(token, password)

    return templates.TemplateResponse(
        request,
        "pages/auth/reset_password_confirm.html",
        {
            "submitted": True,
            "success": reset_succeeded,
            "error": None if reset_succeeded else "Invalid or expired token.",
        },
    )


# ── User Guide ─────────────────────────────────────────────────────────────


@router.get("/user-guide", response_class=HTMLResponse, name="user_guide_page")
async def user_guide_page(request: Request):
    return templates.TemplateResponse(
        request,
        "pages/user_guide.html",
        {
            "site_name": settings.APP_NAME,
            "api_base_url": str(request.base_url).rstrip("/") + "/api",
        },
    )
