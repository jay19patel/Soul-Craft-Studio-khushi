"""
* backbone/config.py
? Central configuration for the Backbone framework.
  Reads from environment variables and .env files via Pydantic Settings.
  Can be used as a singleton (backbone.config.settings) or instantiated
  with custom values and passed to setup_backbone().
"""

import warnings
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class BackboneSettings(BaseSettings):
    """
    All Backbone configuration values with sensible defaults.
    Every value can be overridden via environment variables.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────────────────
    APP_NAME: str = "Backbone App"
    APP_URL: str = "http://localhost:8000"
    ENVIRONMENT: str = "development"  # development | production | testing

    # ── Security ───────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(default="change-me-in-production-use-a-256-bit-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database ───────────────────────────────────────────────────────────
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "backbone_app"

    # ── Redis & Background Tasks ───────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_ENABLED: bool = False
    CACHE_TTL_SECONDS: int = 300
    TASK_BACKEND: str = "asyncio"  # asyncio | redis
    TASK_QUEUE_NAME: str = "backbone:tasks"
    WORKER_CONCURRENCY: int = 4

    # ── Email (SMTP) ───────────────────────────────────────────────────────
    EMAIL_ENABLED: bool = False
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USE_TLS: bool = True
    EMAIL_USERNAME: str = ""
    EMAIL_PASSWORD: str = ""
    EMAIL_FROM_ADDRESS: str = "no-reply@example.com"
    EMAIL_FROM_NAME: str = "Backbone"

    # ── Email Verification Flow ────────────────────────────────────────────
    REQUIRE_EMAIL_VERIFICATION: bool = False
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 1

    # ── Google Sign-In (server-side code exchange) ─────────────────────────
    # ? Must match the OAuth 2.0 Web Client used by the frontend (NEXT_PUBLIC_GOOGLE_CLIENT_ID).
    # ? For @react-oauth/google ``flow: 'auth-code'``, redirect_uri is typically ``postmessage``.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_REDIRECT_URI: str = "postmessage"

    # ── CORS ───────────────────────────────────────────────────────────────
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ── Default Admin User (seed on startup) ──────────────────────────────
    ADMIN_EMAIL: str = "admin@backbone.com"
    ADMIN_PASSWORD: str = "admin123"

    # ── Media / File Storage ───────────────────────────────────────────────
    MEDIA_ROOT: str = "media"
    MEDIA_URL_PREFIX: str = "/media"

    # ── Admin UI ───────────────────────────────────────────────────────────
    ADMIN_PREFIX: str = "/admin"

    # ─────────────────────────────────────────────────────────────────────────
    # Validators
    # ─────────────────────────────────────────────────────────────────────────

    @field_validator(
        "EMAIL_ENABLED",
        "EMAIL_USE_TLS",
        "REQUIRE_EMAIL_VERIFICATION",
        "CACHE_ENABLED",
        mode="before",
    )
    @classmethod
    def coerce_common_boolean_env_strings(cls, value: Any) -> Any:
        """Accept ``true``/``1``/``yes`` strings from ``.env`` for boolean flags."""
        if isinstance(value, str):
            normalised = value.strip().lower()
            if normalised in ("true", "1", "yes", "on"):
                return True
            if normalised in ("false", "0", "no", "off", ""):
                return False
        return value

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key_is_changed(cls, value: str) -> str:
        if value == "change-me-in-production-use-a-256-bit-key":
            warnings.warn(
                "BackboneSettings: SECRET_KEY is the default insecure value. "
                "Set a strong SECRET_KEY before deploying to production.",
                UserWarning,
                stacklevel=2,
            )
        return value

    # ─────────────────────────────────────────────────────────────────────────
    # Computed Properties
    # ─────────────────────────────────────────────────────────────────────────

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT == "testing"

    @property
    def media_root_path(self) -> Path:
        return Path(self.MEDIA_ROOT)

    @property
    def backbone_templates_path(self) -> Path:
        """Built-in templates shipped inside the backbone package."""
        return Path(__file__).parent / "templates"

    @property
    def user_templates_path(self) -> Path:
        """Conventional app-level templates directory (cwd/templates)."""
        return Path.cwd() / "templates"


# ? Module-level singleton — importable without instantiation
settings = BackboneSettings()
