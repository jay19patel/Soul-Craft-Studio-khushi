"""
* tests/integration/test_auth.py
? Integration tests for AuthService.
  Uses mongomock-motor to test full business logic without a real MongoDB.
"""

import pytest
import pytest_asyncio
from beanie import init_beanie
from mongomock_motor import AsyncMongoMockClient

from backbone.config import BackboneSettings
from backbone.core.exceptions import (
    AuthenticationException,
    ConflictException,
    EmailNotVerifiedException,
)
from backbone.domain.models import Attachment, Session, User
from backbone.services.auth import AuthService
from backbone.utils.security import PasswordManager, TokenManager

TEST_SETTINGS = BackboneSettings(
    ENVIRONMENT="testing",
    SECRET_KEY="integration-test-secret-key-256bits-long",
    EMAIL_ENABLED=False,
    CACHE_ENABLED=False,
    REQUIRE_EMAIL_VERIFICATION=False,
)

VERIFICATION_SETTINGS = BackboneSettings(
    ENVIRONMENT="testing",
    SECRET_KEY="integration-test-secret-key-256bits-long",
    EMAIL_ENABLED=False,
    CACHE_ENABLED=False,
    REQUIRE_EMAIL_VERIFICATION=True,
)


@pytest_asyncio.fixture(autouse=True)
async def fresh_db():
    """Fresh in-memory database for each test."""
    client = AsyncMongoMockClient()
    await init_beanie(
        database=client["auth_test"],
        document_models=[User, Session, Attachment],
    )
    yield
    client.close()


@pytest.mark.asyncio
class TestRegisterUser:
    async def test_registration_creates_verified_user_when_verification_disabled(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        user = await service.register_user("test@example.com", "password123", "Test User")
        assert user.email == "test@example.com"
        assert user.is_verified is True
        assert user.verification_token is None

    async def test_registration_creates_unverified_user_when_verification_enabled(self):
        service = AuthService(app_settings=VERIFICATION_SETTINGS)
        user = await service.register_user("test@example.com", "password123", "Test User")
        assert user.is_verified is False
        assert user.verification_token is not None

    async def test_duplicate_email_raises_conflict_exception(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        await service.register_user("dup@example.com", "pass1234", "First")
        with pytest.raises(ConflictException):
            await service.register_user("dup@example.com", "pass5678", "Second")

    async def test_password_is_hashed_on_storage(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        plain_password = "plaintext123"
        user = await service.register_user("hash@example.com", plain_password, "Hash Test")
        assert user.hashed_password != plain_password
        assert PasswordManager.verify_password(plain_password, user.hashed_password)


@pytest.mark.asyncio
class TestAuthenticateUser:
    async def test_valid_credentials_return_user(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        await service.register_user("login@example.com", "password123", "Login User")
        user = await service.authenticate_user("login@example.com", "password123")
        assert user.email == "login@example.com"

    async def test_wrong_password_raises_authentication_exception(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        await service.register_user("wrong@example.com", "correctpass", "Wrong Pass")
        with pytest.raises(AuthenticationException):
            await service.authenticate_user("wrong@example.com", "wrongpass")

    async def test_nonexistent_email_raises_authentication_exception(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        with pytest.raises(AuthenticationException):
            await service.authenticate_user("nobody@example.com", "anypass")

    async def test_unverified_user_raises_email_not_verified_exception(self):
        service = AuthService(app_settings=VERIFICATION_SETTINGS)
        await service.register_user("unverified@example.com", "password123", "Unverified")
        with pytest.raises(EmailNotVerifiedException):
            await service.authenticate_user("unverified@example.com", "password123")

    async def test_deactivated_user_raises_authentication_exception(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        user = await service.register_user("inactive@example.com", "password123", "Inactive")
        await user.set({"is_active": False})
        with pytest.raises(AuthenticationException):
            await service.authenticate_user("inactive@example.com", "password123")


@pytest.mark.asyncio
class TestCreateUserSession:
    async def test_session_creation_returns_tokens(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        user = await service.register_user("session@example.com", "pass1234", "Session User")
        tokens = await service.create_user_session(user)
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert tokens["token_type"] == "bearer"

    async def test_access_token_contains_user_id(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        user = await service.register_user("token@example.com", "pass1234", "Token User")
        tokens = await service.create_user_session(user)
        payload = TokenManager.decode_token(tokens["access_token"], app_settings=TEST_SETTINGS)
        assert payload["sub"] == str(user.id)
        assert payload["type"] == "access"


@pytest.mark.asyncio
class TestEmailVerification:
    async def test_valid_token_verifies_user(self):
        service = AuthService(app_settings=VERIFICATION_SETTINGS)
        user = await service.register_user("verify@example.com", "pass1234", "Verify User")
        assert user.verification_token is not None

        success = await service.verify_email_with_token(user.verification_token)
        assert success is True

        refreshed_user = await User.get(user.id)
        assert refreshed_user.is_verified is True
        assert refreshed_user.verification_token is None

    async def test_invalid_token_returns_false(self):
        service = AuthService(app_settings=VERIFICATION_SETTINGS)
        success = await service.verify_email_with_token("invalid-token-string")
        assert success is False


@pytest.mark.asyncio
class TestPasswordReset:
    async def test_reset_token_is_generated_for_existing_user(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        await service.register_user("reset@example.com", "old_pass123", "Reset User")
        token = await service.generate_password_reset_token("reset@example.com")
        assert token is not None

    async def test_reset_token_for_nonexistent_email_returns_none(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        token = await service.generate_password_reset_token("nobody@example.com")
        assert token is None

    async def test_valid_reset_token_updates_password(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        user = await service.register_user("newpass@example.com", "old_pass123", "Reset Me")
        token = await service.generate_password_reset_token("newpass@example.com")
        success = await service.reset_password_with_token(token, "new_secure_pass123")
        assert success is True

        updated_user = await User.get(user.id)
        assert PasswordManager.verify_password("new_secure_pass123", updated_user.hashed_password)
        assert updated_user.password_reset_token is None

    async def test_invalid_reset_token_returns_false(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        success = await service.reset_password_with_token("bad-token", "newpass123")
        assert success is False


@pytest.mark.asyncio
class TestGoogleAuthorizationCode:
    async def test_google_code_creates_user_when_token_exchange_succeeds(self, monkeypatch):
        class FakeResponse:
            def __init__(self, status_code: int, payload: dict | None = None, text: str = ""):
                self.status_code = status_code
                self._payload = payload or {}
                self.text = text

            def json(self) -> dict:
                return self._payload

        class FakeAsyncClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args: object) -> None:
                return None

            async def post(self, url: str, **kwargs: object) -> FakeResponse:
                assert "oauth2.googleapis.com/token" in url
                return FakeResponse(200, {"access_token": "google-test-access"})

            async def get(self, url: str, **kwargs: object) -> FakeResponse:
                assert "googleapis.com/oauth2/v3/userinfo" in url
                return FakeResponse(
                    200,
                    {
                        "email": "google_new@example.com",
                        "name": "Google New",
                        "email_verified": True,
                        "picture": "https://lh3.googleusercontent.com/a/test-avatar",
                    },
                )

        monkeypatch.setattr("backbone.services.auth.httpx.AsyncClient", lambda **kw: FakeAsyncClient())

        async def fake_google_avatar(service, picture_url: str):
            from backbone.web.routers.admin.helpers import build_beanie_link_from_object_id_string

            row = Attachment(
                filename="google-avatar.jpg",
                file_path="/media/avatar.jpg",
                content_type="image/jpeg",
                size=1.0,
            )
            await row.insert()
            return build_beanie_link_from_object_id_string(Attachment, str(row.id))

        monkeypatch.setattr(
            AuthService,
            "_google_picture_url_to_profile_attachment_link",
            fake_google_avatar,
        )

        google_settings = BackboneSettings(
            ENVIRONMENT="testing",
            SECRET_KEY="integration-test-secret-key-256bits-long",
            EMAIL_ENABLED=False,
            CACHE_ENABLED=False,
            REQUIRE_EMAIL_VERIFICATION=False,
            GOOGLE_CLIENT_ID="test.apps.googleusercontent.com",
            GOOGLE_CLIENT_SECRET="test-secret-value",
        )
        service = AuthService(app_settings=google_settings)
        user, is_new = await service.authenticate_with_google_authorization_code(
            "fake-auth-code-value"
        )
        assert is_new is True
        assert user.email == "google_new@example.com"
        assert user.is_google_account is True
        assert user.is_verified is True
        assert user.profile_image is not None

    async def test_google_code_raises_when_server_credentials_missing(self):
        service = AuthService(app_settings=TEST_SETTINGS)
        with pytest.raises(AuthenticationException):
            await service.authenticate_with_google_authorization_code("any-code")
