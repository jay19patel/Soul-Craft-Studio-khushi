"""
* tests/unit/test_permissions.py
? Unit tests for Backbone permission classes.
  Uses a mock Request and User object — no database required.
"""

from unittest.mock import MagicMock

import pytest

from backbone.core.enums import UserRole
from backbone.web.permissions.base import (
    AllowAny,
    IsAdminUser,
    IsAuthenticated,
    IsOwner,
    IsStaffUser,
)


def _make_mock_request() -> MagicMock:
    return MagicMock()


def _make_mock_user(role: UserRole = UserRole.USER, user_id: str = "user-123") -> MagicMock:
    user = MagicMock()
    user.role = role
    user.id = user_id
    return user


@pytest.mark.asyncio
class TestAllowAny:
    async def test_allows_unauthenticated_requests(self):
        perm = AllowAny(_make_mock_request(), user=None)
        assert await perm.has_permission() is True

    async def test_allows_authenticated_requests(self):
        perm = AllowAny(_make_mock_request(), user=_make_mock_user())
        assert await perm.has_permission() is True


@pytest.mark.asyncio
class TestIsAuthenticated:
    async def test_denies_unauthenticated_user(self):
        from fastapi import HTTPException

        perm = IsAuthenticated(_make_mock_request(), user=None)
        with pytest.raises(HTTPException) as exc_info:
            await perm.has_permission()
        assert exc_info.value.status_code == 401

    async def test_allows_authenticated_user(self):
        perm = IsAuthenticated(_make_mock_request(), user=_make_mock_user())
        assert await perm.has_permission() is True


@pytest.mark.asyncio
class TestIsAdminUser:
    async def test_allows_admin_role(self):
        perm = IsAdminUser(_make_mock_request(), user=_make_mock_user(role=UserRole.ADMIN))
        assert await perm.has_permission() is True

    async def test_allows_superuser_role(self):
        perm = IsAdminUser(_make_mock_request(), user=_make_mock_user(role=UserRole.SUPERUSER))
        assert await perm.has_permission() is True

    async def test_denies_regular_user(self):
        from fastapi import HTTPException

        perm = IsAdminUser(_make_mock_request(), user=_make_mock_user(role=UserRole.USER))
        with pytest.raises(HTTPException) as exc_info:
            await perm.has_permission()
        assert exc_info.value.status_code == 403

    async def test_denies_staff_user(self):
        from fastapi import HTTPException

        perm = IsAdminUser(_make_mock_request(), user=_make_mock_user(role=UserRole.STAFF))
        with pytest.raises(HTTPException):
            await perm.has_permission()

    async def test_denies_unauthenticated_request(self):
        from fastapi import HTTPException

        perm = IsAdminUser(_make_mock_request(), user=None)
        with pytest.raises(HTTPException) as exc_info:
            await perm.has_permission()
        assert exc_info.value.status_code == 401


@pytest.mark.asyncio
class TestIsStaffUser:
    async def test_allows_staff_role(self):
        perm = IsStaffUser(_make_mock_request(), user=_make_mock_user(role=UserRole.STAFF))
        assert await perm.has_permission() is True

    async def test_allows_admin_role(self):
        perm = IsStaffUser(_make_mock_request(), user=_make_mock_user(role=UserRole.ADMIN))
        assert await perm.has_permission() is True

    async def test_denies_regular_user(self):
        from fastapi import HTTPException

        perm = IsStaffUser(_make_mock_request(), user=_make_mock_user(role=UserRole.USER))
        with pytest.raises(HTTPException):
            await perm.has_permission()


@pytest.mark.asyncio
class TestIsOwner:
    async def test_grants_access_to_document_creator(self):
        user = _make_mock_user(user_id="owner-999")
        document = MagicMock()
        document.created_by = "owner-999"
        perm = IsOwner(_make_mock_request(), user=user)
        assert await perm.has_object_permission(document) is True

    async def test_denies_access_to_non_creator(self):
        user = _make_mock_user(user_id="other-user")
        document = MagicMock()
        document.created_by = "owner-999"
        perm = IsOwner(_make_mock_request(), user=user)
        assert await perm.has_object_permission(document) is False

    async def test_denies_unauthenticated_user_at_view_level(self):
        from fastapi import HTTPException

        perm = IsOwner(_make_mock_request(), user=None)
        with pytest.raises(HTTPException) as exc_info:
            await perm.has_permission()
        assert exc_info.value.status_code == 401


@pytest.mark.asyncio
class TestPermissionComposition:
    async def test_and_operator_requires_both_permissions(self):
        request = _make_mock_request()
        user = _make_mock_user(role=UserRole.ADMIN)

        # IsAuthenticated AND IsAdminUser → should pass for admin
        combined_class = IsAuthenticated & IsAdminUser
        combined_instance = combined_class(request, user)
        assert await combined_instance.has_permission() is True

    async def test_and_operator_fails_if_one_permission_fails(self):
        from fastapi import HTTPException

        request = _make_mock_request()
        user = _make_mock_user(role=UserRole.USER)

        combined_class = IsAuthenticated & IsAdminUser
        combined_instance = combined_class(request, user)
        with pytest.raises(HTTPException):
            await combined_instance.has_permission()

    async def test_or_operator_passes_if_either_permission_passes(self):
        request = _make_mock_request()
        user = _make_mock_user(role=UserRole.USER)

        # AllowAny OR IsAdminUser → passes because AllowAny allows
        combined_class = AllowAny | IsAdminUser
        combined_instance = combined_class(request, user)
        assert await combined_instance.has_permission() is True
