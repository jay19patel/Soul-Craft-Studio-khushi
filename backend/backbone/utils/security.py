"""
* backbone/utils/security.py
? Password hashing (Argon2) and JWT token management.
"""

import logging
from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from backbone.config import BackboneSettings
from backbone.config import settings as default_settings

logger = logging.getLogger("backbone.utils.security")


class PasswordManager:
    """Argon2-based password hashing and verification."""

    _pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

    @classmethod
    def hash_password(cls, plain_password: str) -> str:
        return cls._pwd_context.hash(plain_password)

    @classmethod
    def verify_password(cls, plain_password: str, hashed_password: str | None) -> bool:
        if not hashed_password:
            return False
        return cls._pwd_context.verify(plain_password, hashed_password)


class TokenManager:
    """JWT creation and decoding with configurable settings."""

    @staticmethod
    def create_access_token(
        payload: dict,
        sid: str,
        expires_delta: timedelta | None = None,
        app_settings: BackboneSettings | None = None,
    ) -> str:
        resolved_settings = app_settings or default_settings
        expire = datetime.now(UTC) + (
            expires_delta or timedelta(minutes=resolved_settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        token_data = {**payload, "exp": expire, "type": "access", "sid": sid}
        return jwt.encode(
            token_data, resolved_settings.SECRET_KEY, algorithm=resolved_settings.ALGORITHM
        )

    @staticmethod
    def create_refresh_token(
        payload: dict,
        sid: str,
        app_settings: BackboneSettings | None = None,
    ) -> str:
        resolved_settings = app_settings or default_settings
        expire = datetime.now(UTC) + timedelta(days=resolved_settings.REFRESH_TOKEN_EXPIRE_DAYS)
        token_data = {**payload, "exp": expire, "type": "refresh", "sid": sid}
        return jwt.encode(
            token_data, resolved_settings.SECRET_KEY, algorithm=resolved_settings.ALGORITHM
        )

    @staticmethod
    def create_action_token(
        payload: dict,
        action: str,
        expires_delta: timedelta | None = None,
        app_settings: BackboneSettings | None = None,
    ) -> str:
        """
        Create a short-lived token for a specific one-time action
        (e.g. email-verification, password-reset).
        """
        resolved_settings = app_settings or default_settings
        expire = datetime.now(UTC) + (expires_delta or timedelta(hours=24))
        token_data = {**payload, "exp": expire, "action": action}
        return jwt.encode(
            token_data, resolved_settings.SECRET_KEY, algorithm=resolved_settings.ALGORITHM
        )

    @staticmethod
    def decode_token(
        token: str,
        app_settings: BackboneSettings | None = None,
    ) -> dict | None:
        resolved_settings = app_settings or default_settings
        try:
            return jwt.decode(
                token,
                resolved_settings.SECRET_KEY,
                algorithms=[resolved_settings.ALGORITHM],
            )
        except jwt.ExpiredSignatureError:
            logger.debug("Token expired.")
            return None
        except jwt.InvalidTokenError as exc:
            logger.debug("Invalid token: %s", exc)
            return None
