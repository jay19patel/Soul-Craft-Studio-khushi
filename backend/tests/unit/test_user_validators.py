"""* tests/unit/test_user_validators.py
? User model tolerates bad string sentinels often found in MongoDB / admin saves.
"""

from datetime import UTC, datetime

import pytest

from backbone.core.enums import UserRole
from backbone.domain.models import User


@pytest.mark.asyncio
async def test_user_document_loads_when_optional_datetimes_are_string_none(
    initialized_test_database,
) -> None:
    raw_document = {
        "email": "bad_dates@test.com",
        "full_name": "Bad Dates User",
        "hashed_password": "argon2$dummy",
        "role": UserRole.USER.value,
        "is_active": True,
        "is_verified": True,
        "verification_token_expires_at": "None",
        "password_reset_token_expires_at": "None",
        "headline": "None",
        "created_at": datetime.now(UTC),
    }
    await User.get_pymongo_collection().insert_one(raw_document)

    loaded = await User.find_one(User.email == "bad_dates@test.com")
    assert loaded is not None
    assert loaded.verification_token_expires_at is None
    assert loaded.password_reset_token_expires_at is None
    assert loaded.headline is None
