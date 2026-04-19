"""
* backbone/web/permissions/base.py
? DRF-style permission system for Backbone views.
  Permissions are classes with has_permission() and has_object_permission() methods.
  They compose with & and | operators and integrate with FastAPI Depends.

  Role checks align with the backbone.core.enums.UserRole enum.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from fastapi import Depends, HTTPException, Request, status

from backbone.core.dependencies import get_current_user, get_optional_user
from backbone.core.enums import UserRole

# ── Composition Operators ──────────────────────────────────────────────────


class AND:
    """Composed permission requiring both operands to grant access."""

    def __init__(self, request: Request, user: Any, op1: Any, op2: Any) -> None:
        self._op1 = op1
        self._op2 = op2

    async def has_permission(self) -> bool:
        return await self._op1.has_permission() and await self._op2.has_permission()

    async def has_object_permission(self, obj: Any) -> bool:
        return await self._op1.has_object_permission(obj) and await self._op2.has_object_permission(
            obj
        )


class OR:
    """Composed permission where either operand may grant access."""

    def __init__(self, request: Request, user: Any, op1: Any, op2: Any) -> None:
        self._op1 = op1
        self._op2 = op2

    async def has_permission(self) -> bool:
        return await self._op1.has_permission() or await self._op2.has_permission()

    async def has_object_permission(self, obj: Any) -> bool:
        return await self._op1.has_object_permission(obj) or await self._op2.has_object_permission(
            obj
        )


class OperandHolder:
    """Lazily composes two permission operands with a logical operator."""

    def __init__(self, operator_class: type, op1_class: Any, op2_class: Any) -> None:
        self.operator_class = operator_class
        self.op1_class = op1_class
        self.op2_class = op2_class

    def __call__(self, request: Request, user: Any | None = None) -> Any:
        op1_instance = self.op1_class(request, user)
        op2_instance = self.op2_class(request, user)
        return self.operator_class(request, user, op1_instance, op2_instance)

    def __and__(self, other: Any) -> OperandHolder:
        return OperandHolder(AND, self, other)

    def __or__(self, other: Any) -> OperandHolder:
        return OperandHolder(OR, self, other)


class BasePermissionMetaclass(type):
    """Enables  MyPermission & OtherPermission  and  A | B  on class objects."""

    def __and__(cls, other: Any) -> OperandHolder:
        return OperandHolder(AND, cls, other)

    def __or__(cls, other: Any) -> OperandHolder:  # type: ignore[override]
        return OperandHolder(OR, cls, other)


# ── Base Permission ────────────────────────────────────────────────────────


class BasePermission(metaclass=BasePermissionMetaclass):
    """
    Abstract base for all Backbone permission classes.

    Subclass and override has_permission() and / or has_object_permission().

    Example::
        class IsPublishedContent(BasePermission):
            async def has_object_permission(self, obj):
                return getattr(obj, "is_published", False)
    """

    def __init__(self, request: Request, user: Any | None = None) -> None:
        self.request = request
        self.user = user

    async def has_permission(self) -> bool:
        return True

    async def has_object_permission(self, obj: Any) -> bool:
        return True


# ── Built-in Permissions ───────────────────────────────────────────────────


class AllowAny(BasePermission):
    """No restrictions — all requests are allowed."""

    async def has_permission(self) -> bool:
        return True


class IsAuthenticated(BasePermission):
    """Requires a valid, active authenticated user."""

    async def has_permission(self) -> bool:
        if not self.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication credentials were not provided.",
            )
        return True


class IsStaffUser(BasePermission):
    """
    Grants access to users with role STAFF, ADMIN, or SUPERUSER.
    Aligns with UserRole.STAFF+.
    """

    async def has_permission(self) -> bool:
        if not self.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )
        allowed_roles = {UserRole.STAFF, UserRole.ADMIN, UserRole.SUPERUSER}
        if self.user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff access required.",
            )
        return True


class IsAdminUser(BasePermission):
    """
    Grants access to users with role ADMIN or SUPERUSER.
    """

    async def has_permission(self) -> bool:
        if not self.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )
        allowed_roles = {UserRole.ADMIN, UserRole.SUPERUSER}
        if self.user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required.",
            )
        return True


class IsSuperUser(BasePermission):
    """Grants access only to SUPERUSER role."""

    async def has_permission(self) -> bool:
        if not self.user or self.user.role != UserRole.SUPERUSER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Superuser access required.",
            )
        return True


class IsOwner(BasePermission):
    """
    View-level: requires authentication.
    Object-level: checks the object's created_by field against the current user.
    """

    async def has_permission(self) -> bool:
        if not self.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for owner-based access.",
            )
        return True

    async def has_object_permission(self, obj: Any) -> bool:
        if not self.user:
            return False
        creator_id = (
            obj.get("created_by") if isinstance(obj, dict) else getattr(obj, "created_by", None)
        )
        return str(creator_id) == str(self.user.id)


# ── Permission Dependency Factory ──────────────────────────────────────────

_AUTH_REQUIRING_PERMISSION_CLASSES = (
    IsAuthenticated,
    IsOwner,
    IsAdminUser,
    IsStaffUser,
    IsSuperUser,
)


def _does_require_authentication(permission_classes: Sequence[Any]) -> bool:
    for perm_class in permission_classes:
        if isinstance(perm_class, OperandHolder):
            return True
        if isinstance(perm_class, type) and issubclass(
            perm_class, _AUTH_REQUIRING_PERMISSION_CLASSES
        ):
            return True
    return False


def PermissionDependency(permission_classes: list[Any]) -> Callable:
    """
    Factory that builds a FastAPI Depends-compatible async function which
    checks all given permission classes in order.

    Automatically uses get_current_user vs get_optional_user based on
    whether any permission class requires authentication.

    Example::
        @router.get("/", dependencies=[Depends(PermissionDependency([IsAuthenticated]))])
        async def my_view(): ...
    """
    needs_auth = _does_require_authentication(permission_classes)
    user_dependency = get_current_user if needs_auth else get_optional_user

    async def check_permissions(
        request: Request,
        user: Any | None = Depends(user_dependency),
    ) -> Any | None:
        for perm_class in permission_classes:
            perm_instance = perm_class(request, user)
            if not await perm_instance.has_permission():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied.",
                )
        return user

    return check_permissions
