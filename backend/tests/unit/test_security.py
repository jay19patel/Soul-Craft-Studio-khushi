"""
* tests/unit/test_security.py
? Unit tests for PasswordManager and TokenManager.
  Pure in-memory tests — no database required.
"""

from datetime import timedelta

from backbone.config import BackboneSettings
from backbone.utils.security import PasswordManager, TokenManager

# ? Test settings with a known secret key
TEST_SETTINGS = BackboneSettings(
    SECRET_KEY="test-secret-key-for-unit-tests-only-256bits",
    ENVIRONMENT="testing",
    EMAIL_ENABLED=False,
    CACHE_ENABLED=False,
)


class TestPasswordManager:
    def test_hashed_password_is_different_from_plain(self):
        plain = "securepassword123"
        hashed = PasswordManager.hash_password(plain)
        assert hashed != plain

    def test_correct_password_verifies_successfully(self):
        plain = "correctpassword"
        hashed = PasswordManager.hash_password(plain)
        assert PasswordManager.verify_password(plain, hashed) is True

    def test_wrong_password_fails_verification(self):
        hashed = PasswordManager.hash_password("rightpassword")
        assert PasswordManager.verify_password("wrongpassword", hashed) is False

    def test_verify_password_returns_false_when_stored_hash_is_missing(self):
        assert PasswordManager.verify_password("any", None) is False

    def test_two_hashes_of_same_password_are_different(self):
        plain = "samepassword"
        hash_one = PasswordManager.hash_password(plain)
        hash_two = PasswordManager.hash_password(plain)
        # ? Argon2 includes a random salt — hashes should differ
        assert hash_one != hash_two

    def test_empty_password_can_be_hashed(self):
        hashed = PasswordManager.hash_password("")
        assert PasswordManager.verify_password("", hashed) is True


class TestTokenManager:
    def test_access_token_decodes_with_correct_type(self):
        token = TokenManager.create_access_token(
            {"sub": "user-123"}, sid="session-abc", app_settings=TEST_SETTINGS
        )
        payload = TokenManager.decode_token(token, app_settings=TEST_SETTINGS)
        assert payload is not None
        assert payload["type"] == "access"
        assert payload["sub"] == "user-123"
        assert payload["sid"] == "session-abc"

    def test_refresh_token_decodes_with_correct_type(self):
        token = TokenManager.create_refresh_token(
            {"sub": "user-123"}, sid="session-abc", app_settings=TEST_SETTINGS
        )
        payload = TokenManager.decode_token(token, app_settings=TEST_SETTINGS)
        assert payload is not None
        assert payload["type"] == "refresh"

    def test_action_token_carries_correct_action(self):
        token = TokenManager.create_action_token(
            {"sub": "user@test.com"},
            action="verify_email",
            app_settings=TEST_SETTINGS,
        )
        payload = TokenManager.decode_token(token, app_settings=TEST_SETTINGS)
        assert payload is not None
        assert payload["action"] == "verify_email"
        assert payload["sub"] == "user@test.com"

    def test_expired_token_returns_none(self):
        token = TokenManager.create_access_token(
            {"sub": "user-123"},
            sid="session-abc",
            expires_delta=timedelta(seconds=-1),  # already expired
            app_settings=TEST_SETTINGS,
        )
        payload = TokenManager.decode_token(token, app_settings=TEST_SETTINGS)
        assert payload is None

    def test_token_signed_with_different_key_returns_none(self):
        other_settings = BackboneSettings(
            SECRET_KEY="completely-different-secret-key-value",
            ENVIRONMENT="testing",
        )
        token = TokenManager.create_access_token(
            {"sub": "user-123"}, sid="abc", app_settings=other_settings
        )
        payload = TokenManager.decode_token(token, app_settings=TEST_SETTINGS)
        assert payload is None

    def test_invalid_token_string_returns_none(self):
        payload = TokenManager.decode_token("not.a.valid.jwt", app_settings=TEST_SETTINGS)
        assert payload is None

    def test_empty_token_string_returns_none(self):
        payload = TokenManager.decode_token("", app_settings=TEST_SETTINGS)
        assert payload is None
