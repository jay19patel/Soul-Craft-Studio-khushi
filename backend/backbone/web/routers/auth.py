"""
* backbone/web/routers/auth.py
? Authentication API endpoints: register, login, verify email,
  logout, refresh, password reset, and /me.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from backbone.config import settings
from backbone.core.dependencies import get_current_user
from backbone.core.exceptions import (
    AuthenticationException,
    ConflictException,
    EmailNotVerifiedException,
)
from backbone.schemas.auth import (
    GoogleLoginSchema,
    LoginSchema,
    PasswordResetConfirmSchema,
    PasswordResetRequestSchema,
    RegisterSchema,
    TokenResponse,
    UserOut,
)
from backbone.services.auth import AuthService
from backbone.services.mail import MailService

logger = logging.getLogger("backbone.web.routers.auth")

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Register ───────────────────────────────────────────────────────────────


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(registration_data: RegisterSchema):
    """
    Register a new user account.
    If REQUIRE_EMAIL_VERIFICATION=True, the user will receive a verification email
    and cannot log in until they verify their address.
    """
    auth_service = AuthService()
    mail_service = MailService()

    try:
        new_user = await auth_service.register_user(
            email=registration_data.email,
            password=registration_data.password,
            full_name=registration_data.full_name,
        )
    except ConflictException as exc:
        raise HTTPException(status_code=409, detail=exc.message)

    from backbone.services.tasks import task_service

    if settings.REQUIRE_EMAIL_VERIFICATION and new_user.verification_token:
        await task_service.enqueue(
            "backbone.services.mail.mail_service.send_email_verification",
            to_email=new_user.email,
            full_name=new_user.full_name,
            verification_token=new_user.verification_token,
        )

    # ? Always send welcome on successful signup (in addition to verification when enabled).
    await task_service.enqueue(
        "backbone.services.mail.mail_service.send_welcome_email",
        to_email=new_user.email,
        full_name=new_user.full_name,
    )

    profile_image_path = await _resolve_user_profile_image_path(new_user)
    return _build_user_out(new_user, profile_image_path=profile_image_path)


# ── Login ──────────────────────────────────────────────────────────────────


@router.post("/login", response_model=TokenResponse)
async def login_user(response: Response, login_data: LoginSchema, request: Request):
    """
    Authenticate and issue access + refresh tokens.
    Sets the refresh token in an HTTP-only cookie.
    """
    auth_service = AuthService()

    try:
        user = await auth_service.authenticate_user(login_data.email, login_data.password)
    except EmailNotVerifiedException as exc:
        raise HTTPException(status_code=403, detail=exc.message)
    except AuthenticationException as exc:
        raise HTTPException(status_code=401, detail=exc.message)

    user_agent = request.headers.get("user-agent")
    client_ip = _resolve_client_ip(request)
    session_tokens = await auth_service.create_user_session(
        user, user_agent=user_agent, ip_address=client_ip
    )

    response.set_cookie(
        key="refresh_token",
        value=session_tokens["refresh_token"],
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return session_tokens


# ── Google Sign-In ─────────────────────────────────────────────────────────


@router.post("/google/login", response_model=TokenResponse)
async def login_with_google(response: Response, body: GoogleLoginSchema, request: Request):
    """
    Exchange a Google authorization ``code`` (from the SPA auth-code flow) for JWTs.
    Requires ``GOOGLE_CLIENT_ID`` / ``GOOGLE_CLIENT_SECRET`` matching the web client.
    """
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Google sign-in is not configured on the server. "
                "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend environment."
            ),
        )

    auth_service = AuthService()

    try:
        user, is_new_google_user = await auth_service.authenticate_with_google_authorization_code(
            body.code
        )
    except AuthenticationException as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message) from None

    user_agent = request.headers.get("user-agent")
    client_ip = _resolve_client_ip(request)
    session_tokens = await auth_service.create_user_session(
        user, user_agent=user_agent, ip_address=client_ip
    )

    if is_new_google_user:
        from backbone.services.tasks import task_service
        await task_service.enqueue(
            "backbone.services.mail.mail_service.send_welcome_email", 
            to_email=user.email, 
            full_name=user.full_name
        )

    response.set_cookie(
        key="refresh_token",
        value=session_tokens["refresh_token"],
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return session_tokens


# ── Email Verification ─────────────────────────────────────────────────────


@router.get("/verify-email")
async def verify_email_address(token: str):
    """
    Verify the user's email address using the token from the verification email.
    """
    auth_service = AuthService()
    verification_succeeded = await auth_service.verify_email_with_token(token)

    if not verification_succeeded:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification token.",
        )

    return {"success": True, "message": "Email verified successfully. You can now log in."}


# ── Current User ───────────────────────────────────────────────────────────


@router.get("/me", response_model=UserOut)
async def get_current_user_profile(current_user=Depends(get_current_user)):
    """Return the authenticated user's profile."""
    profile_image_path = await _resolve_user_profile_image_path(current_user)
    return _build_user_out(current_user, profile_image_path=profile_image_path)


# ── Logout ─────────────────────────────────────────────────────────────────


@router.post("/logout")
async def logout_user(response: Response, current_user=Depends(get_current_user)):
    """Invalidate all active sessions for the current user and clear the cookie."""
    from backbone.domain.models import Session

    await Session.find({"user.$id": current_user.id, "is_active": True}).update(
        {"$set": {"is_active": False}}
    )
    response.delete_cookie("refresh_token")
    return {"success": True, "message": "Logged out successfully."}


# ── Password Reset ─────────────────────────────────────────────────────────


@router.post("/password-reset/request")
async def request_password_reset(body: PasswordResetRequestSchema):
    """
    Request a password reset email.
    Always returns 200 to avoid email enumeration.
    """
    auth_service = AuthService()
    mail_service = MailService()

    reset_token = await auth_service.generate_password_reset_token(body.email)
    if reset_token:
        from backbone.services.tasks import task_service
        user = await auth_service.find_user_by_email(body.email)
        await task_service.enqueue(
            "backbone.services.mail.mail_service.send_password_reset_email",
            to_email=body.email,
            full_name=user.full_name if user else "User",
            reset_token=reset_token,
        )

    return {"success": True, "message": "If that email exists, a reset link has been sent."}


@router.post("/password-reset/confirm")
async def confirm_password_reset(body: PasswordResetConfirmSchema):
    """Confirm a password reset using the token from the reset email."""
    if not body.passwords_match():
        raise HTTPException(status_code=422, detail="Passwords do not match.")

    auth_service = AuthService()
    reset_succeeded = await auth_service.reset_password_with_token(body.token, body.new_password)

    if not reset_succeeded:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    return {"success": True, "message": "Password updated successfully."}


# ── Helpers ────────────────────────────────────────────────────────────────


async def _resolve_user_profile_image_path(user) -> str | None:
    """
    Resolve the public URL/path for ``profile_image``.
    Explicitly fetches the link if it is not yet hydrated.
    """
    attachment = user.profile_image
    if attachment is None:
        return None

    from backbone.domain.models import Attachment
    from beanie.odm.fields import Link

    # 1. Already loaded Attachment object
    if isinstance(attachment, Attachment):
        return attachment.file_path

    # 2. Beanie Link object (needs fetch if not already in .document)
    if isinstance(attachment, Link):
        # ? Try to get already-hydrated doc inside the Link wrapper first
        hydrated = getattr(attachment, "document", None) or getattr(attachment, "_document", None)
        if hydrated and hasattr(hydrated, "file_path"):
            return hydrated.file_path
        
        # ? Fallback: perform async fetch
        try:
            loaded = await attachment.fetch()
            if isinstance(loaded, Attachment):
                return loaded.file_path
        except Exception:
            logger.debug("Failed to fetch profile_image link for user %s", user.id)

    return None


def _build_user_out(user, profile_image_path: str | None = None) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        is_verified=user.is_verified,
        is_google_account=bool(getattr(user, "is_google_account", False)),
        profile_image=profile_image_path,
        headline=user.headline,
        created_at=user.created_at,
    )


def _resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
