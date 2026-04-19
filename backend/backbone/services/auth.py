"""
* backbone/services/auth.py
? Authentication service: register, login, session management,
  email verification, and password reset.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from backbone.config import BackboneSettings
from backbone.config import settings as default_settings
from backbone.core.enums import UserRole
from backbone.core.exceptions import (
    AuthenticationException,
    ConflictException,
    EmailNotVerifiedException,
)
from backbone.repositories.base import BaseRepository
from backbone.utils.security import PasswordManager, TokenManager
from backbone.web.routers.admin.helpers import (
    build_beanie_link_from_object_id_string,
    download_https_url_and_save_as_attachment,
)

logger = logging.getLogger("backbone.services.auth")


class AuthService:
    """
    Orchestrates all authentication use cases.
    Constructed per-request; takes optional settings for testability.
    """

    def __init__(self, app_settings: BackboneSettings | None = None) -> None:
        from backbone.domain.models import Session, User

        self._settings = app_settings or default_settings
        self._user_repo = BaseRepository(User)
        self._session_repo = BaseRepository(Session)

    # ── User Lookup ────────────────────────────────────────────────────────

    async def find_user_by_email(self, email: str):
        from backbone.domain.models import User

        return await User.find_one(User.email == email)

    # ── Registration ───────────────────────────────────────────────────────

    async def register_user(
        self,
        email: str,
        password: str,
        full_name: str,
        role: UserRole = UserRole.USER,
    ):
        """
        Create a new user account.
        If REQUIRE_EMAIL_VERIFICATION is enabled the user is created in an
        unverified state and a verification token is generated.
        """
        from backbone.domain.models import User

        existing_user = await self.find_user_by_email(email)
        if existing_user:
            raise ConflictException("A user with this email already exists.")

        hashed_password = PasswordManager.hash_password(password)
        is_verified = not self._settings.REQUIRE_EMAIL_VERIFICATION

        verification_token: str | None = None
        verification_token_expires_at: datetime | None = None

        if self._settings.REQUIRE_EMAIL_VERIFICATION:
            verification_token = TokenManager.create_action_token(
                {"sub": email},
                action="verify_email",
                expires_delta=timedelta(hours=self._settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS),
                app_settings=self._settings,
            )
            verification_token_expires_at = datetime.now(UTC) + timedelta(
                hours=self._settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
            )

        new_user = User(
            email=email,
            full_name=full_name,
            hashed_password=hashed_password,
            role=role,
            is_active=True,
            is_verified=is_verified,
            verification_token=verification_token,
            verification_token_expires_at=verification_token_expires_at,
        )
        await new_user.insert()
        logger.info("Registered new user: %s", email)
        return new_user

    # ── Login ──────────────────────────────────────────────────────────────

    async def authenticate_user(self, email: str, password: str):
        """
        Validate email + password. Returns the User if valid.
        Raises AuthenticationException or EmailNotVerifiedException on failure.
        """
        user = await self.find_user_by_email(email)
        if not user:
            raise AuthenticationException("Invalid email or password.")

        if not PasswordManager.verify_password(password, user.hashed_password):
            raise AuthenticationException("Invalid email or password.")

        if not user.is_active:
            raise AuthenticationException("This account has been deactivated.")

        if self._settings.REQUIRE_EMAIL_VERIFICATION and not user.is_verified:
            raise EmailNotVerifiedException()

        return user

    async def _google_picture_url_to_profile_attachment_link(self, picture_url: str):
        """
        Download a Google (or other HTTPS) avatar URL into local media storage
        and return a ``Link[Attachment]`` for ``User.profile_image``.
        """
        from backbone.domain.models import Attachment

        try:
            attachment_id = await download_https_url_and_save_as_attachment(picture_url)
        except ValueError as exc:
            logger.warning("Google profile image download rejected: %s", exc)
            return None
        except OSError as exc:
            logger.warning("Google profile image could not be written to media root: %s", exc)
            return None
        except Exception as exc:
            logger.warning("Google profile image download failed: %s", exc, exc_info=True)
            return None

        return build_beanie_link_from_object_id_string(Attachment, attachment_id)

    # ── Google (OAuth 2.0 authorization code) ─────────────────────────────

    async def authenticate_with_google_authorization_code(
        self, authorization_code: str
    ) -> tuple[Any, bool]:
        """
        Exchange a one-time Google authorization code for userinfo, then return
        ``(user, is_new_registration)``. Requires ``GOOGLE_CLIENT_ID`` and
        ``GOOGLE_CLIENT_SECRET`` on settings.
        """
        client_id = (self._settings.GOOGLE_CLIENT_ID or "").strip()
        client_secret = (self._settings.GOOGLE_CLIENT_SECRET or "").strip()
        redirect_uri = (self._settings.GOOGLE_OAUTH_REDIRECT_URI or "postmessage").strip()

        if not client_id or not client_secret:
            raise AuthenticationException("Google sign-in is not configured on the server.")

        token_url = "https://oauth2.googleapis.com/token"
        userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"

        async with httpx.AsyncClient(timeout=20.0) as http_client:
            token_response = await http_client.post(
                token_url,
                data={
                    "code": authorization_code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )

            if token_response.status_code != 200:
                logger.warning(
                    "Google token exchange failed (%s): %s",
                    token_response.status_code,
                    token_response.text[:500],
                )
                raise AuthenticationException("Google sign-in could not be validated.")

            token_payload = token_response.json()
            google_access_token = token_payload.get("access_token")
            if not google_access_token:
                raise AuthenticationException("Google did not return an access token.")

            profile_response = await http_client.get(
                userinfo_url,
                headers={"Authorization": f"Bearer {google_access_token}"},
            )

        if profile_response.status_code != 200:
            logger.warning(
                "Google userinfo failed (%s): %s",
                profile_response.status_code,
                profile_response.text[:500],
            )
            raise AuthenticationException("Could not read your Google profile.")

        profile = profile_response.json()
        email = (profile.get("email") or "").strip().lower()
        full_name = (profile.get("name") or "").strip() or (email.split("@")[0] if email else "User")
        email_verified = bool(profile.get("email_verified"))
        profile_picture_url = (profile.get("picture") or "").strip() or None

        if not email:
            raise AuthenticationException("Google did not return an email address for this account.")

        if self._settings.REQUIRE_EMAIL_VERIFICATION and not email_verified:
            raise AuthenticationException("Your Google email is not verified. Use a verified Google account.")

        existing_user = await self.find_user_by_email(email)
        if existing_user:
            if not existing_user.is_active:
                raise AuthenticationException("This account has been deactivated.")

            profile_updates: dict[str, Any] = {}
            if self._settings.REQUIRE_EMAIL_VERIFICATION and not existing_user.is_verified and email_verified:
                profile_updates["is_verified"] = True
            if not getattr(existing_user, "is_google_account", False):
                profile_updates["is_google_account"] = True
            if full_name and full_name != (existing_user.full_name or "").strip():
                profile_updates["full_name"] = full_name
            if profile_picture_url:
                new_profile_link = await self._google_picture_url_to_profile_attachment_link(
                    profile_picture_url
                )
                if new_profile_link is not None:
                    profile_updates["profile_image"] = new_profile_link

            if profile_updates:
                await existing_user.set(profile_updates)
                for field_name, field_value in profile_updates.items():
                    setattr(existing_user, field_name, field_value)
            return existing_user, False

        from backbone.domain.models import User

        initial_profile_image = None
        if profile_picture_url:
            initial_profile_image = await self._google_picture_url_to_profile_attachment_link(
                profile_picture_url
            )

        new_user = User(
            email=email,
            full_name=full_name,
            hashed_password=None,
            role=UserRole.USER,
            is_active=True,
            is_verified=True if email_verified else not self._settings.REQUIRE_EMAIL_VERIFICATION,
            is_google_account=True,
            profile_image=initial_profile_image,
        )
        await new_user.insert()
        logger.info("Registered new Google user: %s", email)
        return new_user, True

    # ── Session Management ─────────────────────────────────────────────────

    async def create_user_session(
        self,
        user,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a new Session and generate access + refresh JWT tokens.
        Returns a dict suitable for the TokenResponse schema.
        """

        user_id = str(user.id)

        # ? Create the session row first to get the session ID (embedded in JWT)
        session = await self._session_repo.create(
            {
                "user": user,
                "refresh_token": "pending",
                "expires_at": datetime.now(UTC)
                + timedelta(days=self._settings.REFRESH_TOKEN_EXPIRE_DAYS),
                "user_agent": user_agent,
                "ip_address": ip_address,
                "is_active": True,
            }
        )

        session_id = str(session.id)
        access_token = TokenManager.create_access_token(
            {"sub": user_id},
            sid=session_id,
            app_settings=self._settings,
        )
        refresh_token = TokenManager.create_refresh_token(
            {"sub": user_id},
            sid=session_id,
            app_settings=self._settings,
        )

        await session.set({"refresh_token": refresh_token})

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    async def invalidate_session_by_id(self, session_id: str) -> bool:
        """Deactivate a session (logout)."""
        from backbone.domain.models import Session

        session = await Session.get(session_id)
        if session:
            await session.set({"is_active": False})
            return True
        return False

    # ── Email Verification ─────────────────────────────────────────────────

    async def verify_email_with_token(self, token: str) -> bool:
        """
        Validate the email verification token and mark the user as verified.
        Returns True on success, False if the token is invalid or expired.
        """

        payload = TokenManager.decode_token(token, app_settings=self._settings)
        if not payload or payload.get("action") != "verify_email":
            return False

        email: str | None = payload.get("sub")
        if not email:
            return False

        user = await self.find_user_by_email(email)
        if not user:
            return False

        if user.is_verified:
            return True  # idempotent — already verified

        # ? Clear token fields after successful verification
        await user.set(
            {
                "is_verified": True,
                "verification_token": None,
                "verification_token_expires_at": None,
            }
        )
        logger.info("Email verified for user: %s", email)
        return True

    # ── Password Reset ─────────────────────────────────────────────────────

    async def generate_password_reset_token(self, email: str) -> str | None:
        """
        Generate a one-time password-reset token and store it on the User.
        Returns the token string so the caller (router/service) can send it via email.
        Returns None if no user with this email exists (silent fail to avoid enumeration).
        """
        user = await self.find_user_by_email(email)
        if not user:
            return None

        expires_in = timedelta(hours=self._settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS)
        token = TokenManager.create_action_token(
            {"sub": str(user.id)},
            action="reset_password",
            expires_delta=expires_in,
            app_settings=self._settings,
        )
        expires_at = datetime.now(UTC) + expires_in
        await user.set(
            {
                "password_reset_token": token,
                "password_reset_token_expires_at": expires_at,
            }
        )
        return token

    async def reset_password_with_token(self, token: str, new_password: str) -> bool:
        """
        Validate the reset token and update the user's password.
        Invalidates the token after use.
        """
        from backbone.domain.models import User

        payload = TokenManager.decode_token(token, app_settings=self._settings)
        if not payload or payload.get("action") != "reset_password":
            return False

        user_id: str | None = payload.get("sub")
        if not user_id:
            return False

        user = await User.get(user_id)
        if not user:
            return False

        # ? Validate the stored token matches (prevents token reuse after re-generation)
        if user.password_reset_token != token:
            return False

        new_hashed = PasswordManager.hash_password(new_password)
        await user.set(
            {
                "hashed_password": new_hashed,
                "password_reset_token": None,
                "password_reset_token_expires_at": None,
            }
        )
        logger.info("Password reset for user id: %s", user_id)
        return True

    # ── Admin User Seeding ─────────────────────────────────────────────────

    async def seed_admin_user(self, email: str, password: str) -> None:
        """
        Ensure the admin user exists and has the correct password.
        Called once on app startup.
        """
        if not email or not password:
            return

        user = await self.find_user_by_email(email)
        hashed = PasswordManager.hash_password(password)

        if not user:
            from backbone.domain.models import User

            admin = User(
                email=email,
                full_name="Administrator",
                hashed_password=hashed,
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            await admin.insert()
            logger.info("Admin user created: %s", email)
        else:
            await user.set({"hashed_password": hashed, "role": UserRole.ADMIN})
            logger.info("Admin user credentials updated: %s", email)
