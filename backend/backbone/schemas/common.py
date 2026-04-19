"""
* backbone/schemas/common.py
? Shared Pydantic response envelopes and pagination schemas.
"""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

DataT = TypeVar("DataT")


class PaginatedResponse(BaseModel, Generic[DataT]):
    """Standard paginated list envelope."""

    total: int
    page: int
    page_size: int
    total_pages: int
    results: list[Any]


class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Any | None = None


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    detail: Any | None = None
