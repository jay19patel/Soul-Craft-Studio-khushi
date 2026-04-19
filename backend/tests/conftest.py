"""
* tests/conftest.py
? Shared pytest fixtures for all Backbone tests.
  Uses mongomock-motor for an in-memory MongoDB that requires no running server.
"""

import asyncio

import pytest
import pytest_asyncio
from beanie import init_beanie

from backbone.config import BackboneSettings
from backbone.domain.models import Attachment, Email, LogEntry, Session, Store, Task, User

# ── Test Settings ──────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def test_settings() -> BackboneSettings:
    """Override-safe settings for the test environment."""
    return BackboneSettings(
        ENVIRONMENT="testing",
        SECRET_KEY="test-secret-key-for-unit-tests-only-256bits",
        MONGODB_URL="mongodb://localhost:27017",
        DATABASE_NAME="backbone_test",
        CACHE_ENABLED=False,
        EMAIL_ENABLED=False,
        REQUIRE_EMAIL_VERIFICATION=False,
        ADMIN_EMAIL="admin@test.com",
        ADMIN_PASSWORD="testpassword123",
    )


# ── Event Loop ─────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── In-Memory MongoDB via mongomock-motor ──────────────────────────────────


@pytest_asyncio.fixture(scope="function")
async def initialized_test_database():
    """
    Provide a fresh in-memory Beanie database for each test function.
    Requires:  pip install mongomock-motor
    """
    try:
        from mongomock_motor import AsyncMongoMockClient

        client = AsyncMongoMockClient()
    except ImportError:
        pytest.skip("mongomock-motor not installed. Run: pip install mongomock-motor")

    await init_beanie(
        database=client["backbone_test"],
        document_models=[User, Session, LogEntry, Attachment, Store, Task, Email],
    )
    yield client
    client.close()


# ── User Fixtures ──────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def sample_regular_user(initialized_test_database) -> User:
    """A regular (non-admin) verified user."""
    from backbone.core.enums import UserRole
    from backbone.utils.security import PasswordManager

    user = User(
        email="user@test.com",
        full_name="Test User",
        hashed_password=PasswordManager.hash_password("password123"),
        role=UserRole.USER,
        is_active=True,
        is_verified=True,
    )
    await user.insert()
    return user


@pytest_asyncio.fixture
async def sample_admin_user(initialized_test_database) -> User:
    """An admin user."""
    from backbone.core.enums import UserRole
    from backbone.utils.security import PasswordManager

    admin = User(
        email="admin@test.com",
        full_name="Admin User",
        hashed_password=PasswordManager.hash_password("adminpassword123"),
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    await admin.insert()
    return admin


@pytest_asyncio.fixture
async def unverified_user(initialized_test_database) -> User:
    """A user who has not yet verified their email."""
    from backbone.core.enums import UserRole
    from backbone.utils.security import PasswordManager

    user = User(
        email="unverified@test.com",
        full_name="Unverified User",
        hashed_password=PasswordManager.hash_password("password123"),
        role=UserRole.USER,
        is_active=True,
        is_verified=False,
        verification_token="test-verification-token",
    )
    await user.insert()
    return user
