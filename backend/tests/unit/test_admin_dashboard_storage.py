"""
* tests/unit/test_admin_dashboard_storage.py
? MongoDB collStats helper used for admin dashboard storage columns.
"""

import pytest

from backbone.web.routers.admin.helpers import (
    BYTES_PER_MEBIBYTE,
    read_mongodb_collection_storage_bytes,
)


@pytest.mark.asyncio
async def test_read_mongodb_collection_storage_bytes_parses_collstats():
    class FakeMongoDatabase:
        async def command(self, spec: dict) -> dict:
            assert spec == {"collStats": "orders"}
            return {"size": 500, "storageSize": 65536, "totalIndexSize": 32768}

    logical, storage, index_bytes = await read_mongodb_collection_storage_bytes(
        FakeMongoDatabase(),
        "orders",
    )
    assert logical == 500
    assert storage == 65536
    assert index_bytes == 32768


@pytest.mark.asyncio
async def test_read_mongodb_collection_storage_bytes_returns_zeros_on_error():
    class BrokenDatabase:
        async def command(self, spec: dict) -> dict:
            raise RuntimeError("no collStats in test double")

    logical, storage, index_bytes = await read_mongodb_collection_storage_bytes(
        BrokenDatabase(),
        "anything",
    )
    assert logical == storage == index_bytes == 0


@pytest.mark.asyncio
async def test_read_mongodb_collection_storage_bytes_empty_name():
    logical, storage, index_bytes = await read_mongodb_collection_storage_bytes(
        object(),
        "",
    )
    assert logical == storage == index_bytes == 0


def test_bytes_per_mebibyte_is_1024_squared():
    assert BYTES_PER_MEBIBYTE == 1024 * 1024
