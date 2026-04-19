"""
* tests/unit/test_repository.py
? Unit tests for BaseRepository using mongomock-motor in-memory DB.
"""

import pytest
import pytest_asyncio
from beanie import Document

from backbone.repositories.base import BaseRepository, build_mongo_filter_from_operator

# ── Fixture Model ──────────────────────────────────────────────────────────


class SampleProduct(Document):
    name: str
    price: float = 0.0
    status: str = "active"
    is_deleted: bool = False

    class Settings:
        name = "test_products"


@pytest_asyncio.fixture
async def product_repo(initialized_test_database):
    """Repository for SampleProduct backed by mongomock."""
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    client = AsyncMongoMockClient()
    await init_beanie(database=client["test_repo"], document_models=[SampleProduct])
    return BaseRepository(SampleProduct)


# ── Operator Filter Builder Tests ──────────────────────────────────────────


class TestBuildMongoFilterFromOperator:
    def test_gt_operator_builds_correctly(self):
        result = build_mongo_filter_from_operator("price", "gt", "100")
        assert result == {"price": {"$gt": 100}}

    def test_gte_operator_builds_correctly(self):
        result = build_mongo_filter_from_operator("score", "gte", "50")
        assert result == {"score": {"$gte": 50}}

    def test_lt_operator_builds_correctly(self):
        result = build_mongo_filter_from_operator("age", "lt", "30")
        assert result == {"age": {"$lt": 30}}

    def test_in_operator_splits_csv(self):
        result = build_mongo_filter_from_operator("status", "in", "active,draft,archived")
        assert result == {"status": {"$in": ["active", "draft", "archived"]}}

    def test_contains_operator_builds_regex(self):
        result = build_mongo_filter_from_operator("name", "contains", "acme")
        assert result == {"name": {"$regex": "acme", "$options": "i"}}

    def test_startswith_operator_builds_anchored_regex(self):
        result = build_mongo_filter_from_operator("title", "startswith", "hello")
        assert result == {"title": {"$regex": "^hello", "$options": "i"}}

    def test_endswith_operator_builds_trailing_regex(self):
        result = build_mongo_filter_from_operator("email", "endswith", ".com")
        assert result == {"email": {"$regex": r".com$", "$options": "i"}}

    def test_string_value_not_coercible_to_number_stays_as_string(self):
        result = build_mongo_filter_from_operator("code", "ne", "XYZ")
        assert result == {"code": {"$ne": "XYZ"}}


# ── Repository CRUD Tests ──────────────────────────────────────────────────


@pytest.mark.asyncio
class TestBaseRepository:
    async def test_create_inserts_document(self, product_repo):
        created = await product_repo.create({"name": "Widget", "price": 9.99})
        assert created.id is not None
        assert created.name == "Widget"
        assert created.price == 9.99

    async def test_get_retrieves_document_by_id(self, product_repo):
        created = await product_repo.create({"name": "Gadget", "price": 19.99})
        fetched = await product_repo.get(str(created.id))
        assert fetched is not None
        assert fetched.name == "Gadget"

    async def test_get_returns_none_for_nonexistent_id(self, product_repo):
        from beanie import PydanticObjectId

        fake_id = str(PydanticObjectId())
        result = await product_repo.get(fake_id)
        assert result is None

    async def test_get_by_field_finds_document(self, product_repo):
        await product_repo.create({"name": "Unique-Slug-Product", "price": 5.0})
        found = await product_repo.get_by_field("name", "Unique-Slug-Product")
        assert found is not None
        assert found.name == "Unique-Slug-Product"

    async def test_list_returns_all_non_deleted_documents(self, product_repo):
        await product_repo.create({"name": "Alpha"})
        await product_repo.create({"name": "Beta"})
        items, total = await product_repo.list({"is_deleted": {"$ne": True}}, skip=0, limit=50)
        assert total >= 2

    async def test_update_modifies_document_fields(self, product_repo):
        created = await product_repo.create({"name": "OldName", "price": 1.0})
        updated = await product_repo.update(str(created.id), {"name": "NewName"})
        assert updated is not None
        assert updated.name == "NewName"

    async def test_update_nonexistent_document_returns_none(self, product_repo):
        from beanie import PydanticObjectId

        fake_id = str(PydanticObjectId())
        result = await product_repo.update(fake_id, {"name": "Ghost"})
        assert result is None

    async def test_soft_delete_sets_is_deleted_flag(self, product_repo):
        created = await product_repo.create({"name": "ToSoftDelete"})
        success = await product_repo.delete(str(created.id), soft=True)
        assert success is True
        fetched = await product_repo.get(str(created.id))
        assert fetched is not None
        assert fetched.is_deleted is True

    async def test_hard_delete_removes_document(self, product_repo):
        created = await product_repo.create({"name": "ToHardDelete"})
        success = await product_repo.delete(str(created.id), soft=False)
        assert success is True
        fetched = await product_repo.get(str(created.id))
        assert fetched is None

    async def test_delete_nonexistent_document_returns_false(self, product_repo):
        from beanie import PydanticObjectId

        fake_id = str(PydanticObjectId())
        result = await product_repo.delete(fake_id)
        assert result is False
