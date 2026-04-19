"""
* backbone/domain/models.py
? Core Beanie documents used by every Backbone application:
  User, Session, Attachment, Store, Task, Email, LogEntry.
"""

from datetime import UTC, datetime
from typing import Any

from beanie import Document, Indexed, Link
from pydantic import EmailStr, Field, field_serializer, field_validator
from pymongo import ASCENDING, DESCENDING, IndexModel

from backbone.core.enums import EmailStatus, LogLevel, TaskStatus, UserRole
from backbone.domain.base import AuditDocument


class Attachment(Document):
    """
    Uploaded file record — linked from other documents via Link[Attachment].
    """

    filename: str
    file_path: str | None = None
    content_type: str
    size: float | None = None
    status: str = Field(default="completed")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    created_by: str | None = None

    @field_serializer("file_path", when_used="json")
    def serialize_file_path(self, file_path: str | None) -> str | None:
        return file_path

    class Settings:
        name = "attachments"


class User(AuditDocument):
    """
    Application user with role-based access control and email verification.
    """

    email: Indexed(EmailStr, unique=True)  # type: ignore[valid-type]
    full_name: str = Field(max_length=200)
    role: UserRole = Field(default=UserRole.USER)

    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=False)

    # ? Optional for OAuth-only or legacy rows; login still requires a valid hash when set
    hashed_password: str | None = None

    profile_image: Link[Attachment] | None = None
    headline: str | None = Field(default=None, max_length=255)
    bio: str | None = None
    is_google_account: bool = Field(default=False)

    # ? Email verification token fields — cleared after successful verification
    verification_token: str | None = None
    verification_token_expires_at: datetime | None = None

    # ? Password reset token — invalidated after use
    password_reset_token: str | None = None
    password_reset_token_expires_at: datetime | None = None

    @field_validator(
        "verification_token_expires_at",
        "password_reset_token_expires_at",
        mode="before",
    )
    @classmethod
    def coerce_invalid_optional_datetime_from_storage(cls, raw_value: Any) -> Any:
        """MongoDB or bad exports sometimes store the literal string 'None' instead of null."""
        if raw_value is None:
            return None
        if isinstance(raw_value, str):
            trimmed = raw_value.strip()
            if not trimmed or trimmed.lower() == "none":
                return None
        return raw_value

    @field_validator(
        "headline",
        "bio",
        "verification_token",
        "password_reset_token",
        mode="before",
    )
    @classmethod
    def coerce_literal_none_string_for_optional_text(cls, raw_value: Any) -> Any:
        """Admin forms occasionally persist the text 'None' for empty optional strings."""
        if isinstance(raw_value, str) and raw_value.strip().lower() == "none":
            return None
        return raw_value

    class Settings:
        name = "users"

    def is_admin(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.SUPERUSER)

    def is_staff_or_above(self) -> bool:
        return self.role in (UserRole.STAFF, UserRole.ADMIN, UserRole.SUPERUSER)


class Session(AuditDocument):
    """Active login session associated with a User."""

    user: Link[User]
    refresh_token: Indexed(str, unique=True)  # type: ignore[valid-type]
    is_active: bool = Field(default=True)
    expires_at: datetime
    user_agent: str | None = None
    ip_address: str | None = None

    class Settings:
        name = "sessions"


class Store(Document):
    """
    Generic key-value store scoped by a string scope key.
    Useful for feature flags, app configs, etc.
    """

    scope: Indexed(str, unique=True)  # type: ignore[valid-type]
    values: dict[str, Any] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "backbone_store"


class Task(Document):
    """Background job record for audit and monitoring."""

    task_id: Indexed(str, unique=True)  # type: ignore[valid-type]
    function_name: str
    status: TaskStatus = Field(default=TaskStatus.QUEUED)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    queued_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    execution_time_seconds: float | None = None
    metadata: dict[str, Any] | None = None

    class Settings:
        name = "task_logs"
        indexes = [
            IndexModel([("status", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ]


class Email(Document):
    """Outbound email record — queued, processed, and audited here."""

    to_email: EmailStr
    subject: str
    status: EmailStatus = Field(default=EmailStatus.QUEUED)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    template_name: str | None = None
    context: dict[str, Any] | None = None
    plain_text_body: str | None = None
    html_body: str | None = None
    from_email: str | None = None

    sent_at: datetime | None = None
    started_at: datetime | None = None
    attempt_count: int = Field(default=0)
    error_message: str | None = None
    error_traceback: str | None = None
    provider_message_id: str | None = None

    class Settings:
        name = "email_logs"
        indexes = [
            IndexModel([("status", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ]


class LogEntry(Document):
    """Structured log record persisted to MongoDB for admin visibility."""

    level: LogLevel = Field(default=LogLevel.INFO)
    message: str
    module: str | None = None
    function: str | None = None
    line: int | None = None
    exception: str | None = None
    extra: dict[str, Any] | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "logs"
        indexes = [
            IndexModel([("level", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ]
