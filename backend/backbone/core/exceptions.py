"""
* backbone/core/exceptions.py
? Backbone exception hierarchy and FastAPI exception handler registration.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# ── Base Exception ─────────────────────────────────────────────────────────


class BackboneException(Exception):
    """Root exception for all Backbone errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        detail: Any | None = None,
        error_code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail = detail or message
        self.error_code = error_code or "BACKBONE_ERROR"


# ── Domain Exceptions ──────────────────────────────────────────────────────


class NotFoundException(BackboneException):
    def __init__(self, message: str = "Resource not found", detail: Any | None = None) -> None:
        super().__init__(message, status_code=404, detail=detail, error_code="NOT_FOUND")


class ValidationException(BackboneException):
    def __init__(self, message: str = "Validation failed", detail: Any | None = None) -> None:
        super().__init__(message, status_code=422, detail=detail, error_code="VALIDATION_ERROR")


class ConflictException(BackboneException):
    def __init__(self, message: str = "Resource conflict", detail: Any | None = None) -> None:
        super().__init__(message, status_code=409, detail=detail, error_code="CONFLICT")


# ── Auth Exceptions ────────────────────────────────────────────────────────


class AuthenticationException(BackboneException):
    def __init__(self, message: str = "Authentication failed", detail: Any | None = None) -> None:
        super().__init__(message, status_code=401, detail=detail, error_code="UNAUTHENTICATED")


class PermissionException(BackboneException):
    def __init__(self, message: str = "Permission denied", detail: Any | None = None) -> None:
        super().__init__(message, status_code=403, detail=detail, error_code="PERMISSION_DENIED")


class EmailNotVerifiedException(BackboneException):
    def __init__(self, message: str = "Email address not verified") -> None:
        super().__init__(message, status_code=403, detail=message, error_code="EMAIL_NOT_VERIFIED")


# ── Service Exceptions ─────────────────────────────────────────────────────


class ServiceException(BackboneException):
    def __init__(self, message: str = "Internal service error", detail: Any | None = None) -> None:
        super().__init__(message, status_code=500, detail=detail, error_code="SERVICE_ERROR")


class MailDeliveryException(ServiceException):
    def __init__(self, message: str = "Email delivery failed") -> None:
        super().__init__(message, detail=message)
        self.error_code = "MAIL_DELIVERY_FAILED"


# ── Handler Registration ───────────────────────────────────────────────────


def register_exception_handlers(app: FastAPI) -> None:
    """
    Register Backbone exception handlers on the given FastAPI app.
    Call this inside setup_backbone so callers get structured JSON errors.
    """

    @app.exception_handler(BackboneException)
    async def handle_backbone_exception(request: Request, exc: BackboneException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error_code": exc.error_code,
                "message": exc.message,
                "detail": exc.detail,
            },
        )
