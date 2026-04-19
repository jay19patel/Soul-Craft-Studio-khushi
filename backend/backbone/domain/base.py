"""
* backbone/domain/base.py
? Backbone base document classes.

  AuditDocument  — timestamps, soft-delete, field-change signals.
  BackboneDocument — automatic slug generation and empty-Link normalization.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from beanie import Delete, Document, Insert, Replace, Save, Update, after_event, before_event
from pydantic import Field, model_validator
from slugify import slugify

from backbone.core.signals import signals


class AuditDocument(Document):
    """
    Extends Beanie Document with:
      - created_at / updated_at timestamps (UTC)
      - created_by / updated_by user references (string IDs)
      - Soft-delete via is_deleted + deleted_at + deleted_by
      - Post-event signals (post_create, post_update, post_delete, on_field_change)
    """

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    created_by: str | None = None
    updated_at: datetime | None = None
    updated_by: str | None = None

    is_deleted: bool = Field(default=False)
    deleted_at: datetime | None = None
    deleted_by: str | None = None

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        # ? Capture initial state so we can compute changed_fields on update
        self._initial_state: dict[str, Any] = (
            self.model_dump(exclude={"revision_id"}) if self.id else {}
        )

    # ── Signal Emissions ────────────────────────────────────────────────────

    @after_event(Insert)
    async def _emit_post_create_signal(self) -> None:
        await signals.post_create.emit(self)

    @after_event(Replace, Save, Update)
    async def _emit_post_update_signal(self) -> None:
        current_state = self.model_dump(exclude={"revision_id"})
        changed_fields = {
            field_name: (self._initial_state[field_name], current_value)
            for field_name, current_value in current_state.items()
            if field_name in self._initial_state
            and self._initial_state[field_name] != current_value
        }

        if changed_fields:
            await signals.on_field_change.emit(self, changed_fields=changed_fields)

        await signals.post_update.emit(self, changed_fields=changed_fields)
        self._initial_state = current_state

    @after_event(Delete)
    async def _emit_post_delete_signal(self) -> None:
        await signals.post_delete.emit(self)

    class Settings:
        use_revision = False


class BackboneDocument(AuditDocument):
    """
    Extends AuditDocument with:
      - Automatic slug generation (mark fields with json_schema_extra={"slugify": True})
      - Empty-string Link normalization (converts "" to None before validation)

    Slug usage example::

        class Article(BackboneDocument):
            title: str
            slug: str = Field(
                default="",
                json_schema_extra={"slugify": True, "populate_from": "title"},
            )
    """

    @before_event(Insert)
    async def _handle_automatic_slug_generation(self) -> None:
        for field_name, field_info in self.model_fields.items():
            extra = field_info.json_schema_extra or {}
            if not extra.get("slugify"):
                continue

            current_value = getattr(self, field_name, None)
            if current_value and current_value != "string":
                continue

            source_field = extra.get("populate_from") or extra.get("depend", "name")
            source_value = getattr(self, source_field, None)
            if not source_value:
                continue

            base_slug = slugify(str(source_value))
            entropy_suffix = str(uuid.uuid4())[:8]
            setattr(
                self, field_name, f"{base_slug}-{entropy_suffix}" if base_slug else entropy_suffix
            )

    @model_validator(mode="after")
    def _normalize_empty_link_strings(self) -> "BackboneDocument":
        """Convert empty strings in link fields to None to avoid Beanie DBRef errors."""
        for field_name in self.model_fields:
            if getattr(self, field_name) == "":
                setattr(self, field_name, None)
        return self
