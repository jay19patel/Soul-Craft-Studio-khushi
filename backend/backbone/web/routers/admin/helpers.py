"""
* backbone/web/routers/admin/helpers.py
? Utility functions for the admin UI: field introspection,
  form data parsing, file/attachment handling, and template filter setup.
"""

import json
import logging
import os
import uuid
from enum import Enum
from typing import Any, Union, get_args, get_origin
from urllib.parse import urlparse

import httpx
from beanie import Document, Link, PydanticObjectId
from bson import DBRef
from bson.errors import InvalidId
from fastapi import Request, UploadFile

logger = logging.getLogger("backbone.web.routers.admin.helpers")

# ? Fields that are managed by the framework — hidden from admin forms
SYSTEM_MANAGED_FIELDS = frozenset(
    {
        "id",
        "_id",
        "revision_id",
        "created_at",
        "created_by",
        "updated_at",
        "updated_by",
        "is_deleted",
        "deleted_at",
        "deleted_by",
    }
)

SENSITIVE_FIELDS = frozenset({"hashed_password", "password"})

# ? File inputs for Link[Attachment] fields use this suffix so they do not share ``name`` with the hidden id (multipart collision).
LINK_ATTACHMENT_UPLOAD_FIELD_SUFFIX = "__upload"

# ? Shown read-only in admin templates (model_detail Record Info); excluded from main edit form
ADMIN_TEMPLATE_INTERNAL_FIELD_NAMES: tuple[str, ...] = (
    "id",
    "_id",
    "revision_id",
    "created_at",
    "created_by",
    "updated_at",
    "updated_by",
    "is_deleted",
    "deleted_at",
    "deleted_by",
)


# ── Field Introspection ────────────────────────────────────────────────────


def collect_all_model_fields(model: type[Document]) -> dict[str, Any]:
    """Walk the MRO to collect all Pydantic field definitions for a model."""
    merged_fields: dict[str, Any] = {}
    for parent_class in reversed(model.__mro__):
        if hasattr(parent_class, "model_fields") and isinstance(parent_class.model_fields, dict):
            merged_fields.update(parent_class.model_fields)
    return merged_fields


def get_displayable_field_names(model: type[Document]) -> list[str]:
    """Return field names suitable for display (excludes system and sensitive fields)."""
    all_fields = collect_all_model_fields(model)
    return [
        name
        for name in all_fields
        if name not in SYSTEM_MANAGED_FIELDS and name not in SENSITIVE_FIELDS
    ]


def discover_link_fields(model: type[Document], registry: dict[str, dict]) -> dict[str, Any]:
    """
    Detect Link[...] and List[Link[...]] fields and map them to their
    registered admin model names.
    """
    all_fields = collect_all_model_fields(model)
    registered_model_map = {cfg["model"]: name for name, cfg in registry.items()}
    link_metadata: dict[str, Any] = {}

    for field_name, field_info in all_fields.items():
        annotation = field_info.annotation
        resolved_model_name = _find_registered_model_name(annotation, registered_model_map)
        if resolved_model_name:
            origin = get_origin(annotation)
            is_multi = origin in (list, list) or "List" in str(annotation)
            link_metadata[field_name] = {
                "model": resolved_model_name,
                "is_multi": is_multi,
            }

    return link_metadata


def build_beanie_link_from_object_id_string(
    linked_document_class: type[Document],
    object_id_string: str,
) -> Link:
    """
    Beanie 2 requires Link(DBRef(collection, id), DocumentClass).
    Admin forms only submit the related document id as text.
    """
    collection_name = (
        getattr(
            getattr(linked_document_class, "Settings", None),
            "name",
            None,
        )
        or linked_document_class.__name__.lower()
    )
    trimmed_object_id = object_id_string.strip()
    try:
        parsed_object_id = PydanticObjectId(trimmed_object_id)
    except InvalidId as exc:
        raise ValueError(f"Invalid document id for link field: {trimmed_object_id!r}") from exc
    document_ref = DBRef(collection_name, parsed_object_id)
    return Link(document_ref, linked_document_class)


def _unwrap_union_optional(type_hint: Any) -> Any:
    origin = get_origin(type_hint)
    if origin is Union:
        non_none_args = [arg for arg in get_args(type_hint) if arg is not type(None)]
        if len(non_none_args) == 1:
            return _unwrap_union_optional(non_none_args[0])
    return type_hint


def _resolve_linked_document_class_from_field_annotation(
    field_annotation: Any,
) -> type[Document] | None:
    """Return the document class inside Link[Doc], Optional[Link[Doc]], or List[Link[Doc]]."""
    current_annotation = _unwrap_union_optional(field_annotation)
    for _ in range(8):
        origin = get_origin(current_annotation)
        type_args = get_args(current_annotation)
        if origin in (list, list):
            if not type_args:
                return None
            current_annotation = _unwrap_union_optional(type_args[0])
            continue
        link_origin = origin if origin is not None else current_annotation
        if getattr(link_origin, "__name__", "") == "Link" and type_args:
            document_class_candidate = type_args[0]
            if isinstance(document_class_candidate, type) and issubclass(
                document_class_candidate, Document
            ):
                return document_class_candidate
            return None
        break
    return None


def _coerce_plain_string_to_enum_if_applicable(field_annotation: Any, string_value: str) -> Any:
    """When the field type is an Enum (possibly wrapped), coerce form strings to enum members."""
    current_annotation = field_annotation
    for _ in range(8):
        current_annotation = _unwrap_union_optional(current_annotation)
        origin = get_origin(current_annotation)
        type_args = get_args(current_annotation)
        if origin in (list, list):
            if not type_args:
                break
            current_annotation = type_args[0]
            continue
        if isinstance(current_annotation, type) and issubclass(current_annotation, Enum):
            try:
                return current_annotation(string_value)
            except ValueError:
                for enum_member in current_annotation:
                    if string_value.lower() == enum_member.name.lower():
                        return enum_member
            break
        break
    return string_value


def _find_registered_model_name(
    type_hint: Any,
    registered_model_map: dict[type, str],
) -> str | None:
    if type_hint in registered_model_map:
        return registered_model_map[type_hint]

    for arg in get_args(type_hint):
        result = _find_registered_model_name(arg, registered_model_map)
        if result:
            return result

    return None


# ── File / Attachment Handling ─────────────────────────────────────────────


async def save_bytes_as_attachment(
    *,
    original_filename: str,
    file_bytes: bytes,
    content_type: str,
) -> str:
    """
    Write bytes under the configured media root and insert an Attachment row.
    Returns the new Attachment id as a string.
    """
    from backbone.config import settings as backbone_settings
    from backbone.domain.models import Attachment

    media_root = backbone_settings.media_root_path
    media_root.mkdir(parents=True, exist_ok=True)

    file_extension = os.path.splitext(original_filename)[1] or ""
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path_on_disk = media_root / unique_filename
    file_path_on_disk.write_bytes(file_bytes)

    url_prefix = backbone_settings.MEDIA_URL_PREFIX.rstrip("/")
    public_path = f"{url_prefix}/{unique_filename}"

    attachment = Attachment(
        filename=original_filename,
        file_path=public_path,
        content_type=content_type or "application/octet-stream",
        size=float(len(file_bytes)),
    )
    await attachment.insert()
    return str(attachment.id)


async def save_uploaded_file_as_attachment(upload_file: UploadFile) -> str | None:
    """
    Save an UploadFile to disk and create an Attachment record.
    Returns the Attachment ID as a string, or None on failure.
    """
    if not upload_file or not upload_file.filename:
        return None

    file_content = await upload_file.read()
    return await save_bytes_as_attachment(
        original_filename=upload_file.filename,
        file_bytes=file_content,
        content_type=upload_file.content_type or "application/octet-stream",
    )


_MAX_REMOTE_DOWNLOAD_BYTES = 15 * 1024 * 1024


def _guess_filename_from_download_url(url: str) -> str:
    parsed = urlparse(url)
    base = os.path.basename(parsed.path) or "download"
    if "." not in base:
        base = f"{base}.jpg"
    return base


async def download_https_url_and_save_as_attachment(image_url: str) -> str:
    """
    Download a remote ``http``/``https`` URL to the media root and insert an ``Attachment``.

    Used by the admin media URL field and by OAuth flows (e.g. Google profile photo).
    Returns the new Attachment document id as a string.

    Raises:
        ValueError: invalid URL scheme, download failure, empty body, or file too large.
    """
    trimmed_url = (image_url or "").strip()
    parsed = urlparse(trimmed_url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http and https URLs are allowed.")

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as http_client:
        remote_response = await http_client.get(trimmed_url)

    if remote_response.status_code >= 400:
        raise ValueError(f"Could not download URL (HTTP {remote_response.status_code}).")

    body = remote_response.content
    if not body:
        raise ValueError("Downloaded file was empty.")
    if len(body) > _MAX_REMOTE_DOWNLOAD_BYTES:
        raise ValueError("Downloaded file is too large.")

    guessed_name = _guess_filename_from_download_url(trimmed_url)
    content_type = (
        remote_response.headers.get("content-type", "application/octet-stream")
        .split(";")[0]
        .strip()
    )
    return await save_bytes_as_attachment(
        original_filename=guessed_name,
        file_bytes=body,
        content_type=content_type,
    )


async def parse_admin_form_data(
    request: Request,
    model_fields: dict[str, Any],
) -> dict[str, Any]:
    """
    Parse multipart form data into a dict suitable for creating/updating a model.
    Handles: text fields, multi-value fields (List), and file uploads (→ Attachment).

    Only keys that appear in the submitted form are populated for non-list fields,
    so omitted sensitive fields (e.g. hashed_password) are not forced to None on update.
    """
    form_data = await request.form()
    submitted_field_names = set(form_data.keys())
    parsed_document_data: dict[str, Any] = {}

    for field_name, field_info in model_fields.items():
        if field_name in SYSTEM_MANAGED_FIELDS:
            continue
        if field_name in SENSITIVE_FIELDS and field_name not in submitted_field_names:
            continue

        annotation = field_info.annotation
        annotation_str = str(annotation).lower()
        is_list_field = _is_list_annotation(annotation)
        is_link_field = "link[" in annotation_str
        linked_document_class = (
            _resolve_linked_document_class_from_field_annotation(annotation)
            if is_link_field
            else None
        )

        raw_values: list[Any] = list(form_data.getlist(field_name))
        if is_link_field:
            raw_values.extend(
                form_data.getlist(f"{field_name}{LINK_ATTACHMENT_UPLOAD_FIELD_SUFFIX}")
            )

        processed_values: list[Any] = []

        for raw_value in raw_values:
            if isinstance(raw_value, UploadFile) and raw_value.filename:
                attachment_id = await save_uploaded_file_as_attachment(raw_value)
                if not attachment_id:
                    continue
                if is_link_field and linked_document_class:
                    processed_values.append(
                        build_beanie_link_from_object_id_string(
                            linked_document_class, attachment_id
                        )
                    )
                elif is_link_field:
                    continue
                else:
                    processed_values.append(attachment_id)
            elif isinstance(raw_value, str):
                stripped_text = raw_value.strip()
                if not stripped_text:
                    continue

                if is_link_field and linked_document_class:
                    processed_values.append(
                        build_beanie_link_from_object_id_string(
                            linked_document_class,
                            stripped_text,
                        )
                    )
                elif "bool" in annotation_str:
                    processed_values.append(stripped_text.lower() == "true")
                elif "int" in annotation_str:
                    try:
                        processed_values.append(int(stripped_text))
                    except ValueError:
                        processed_values.append(stripped_text)
                elif "float" in annotation_str:
                    try:
                        processed_values.append(float(stripped_text))
                    except ValueError:
                        processed_values.append(stripped_text)
                else:
                    processed_values.append(
                        _coerce_plain_string_to_enum_if_applicable(annotation, stripped_text)
                    )

        if is_list_field:
            if field_name in submitted_field_names or processed_values:
                parsed_document_data[field_name] = processed_values
        elif processed_values:
            parsed_document_data[field_name] = processed_values[0]
        elif field_name in submitted_field_names:
            parsed_document_data[field_name] = None

    return parsed_document_data


def _is_list_annotation(annotation: Any) -> bool:
    origin = get_origin(annotation)
    return origin in (list, list) or "List" in str(annotation)


# ── MongoDB dashboard storage (collStats) ───────────────────────────────────


BYTES_PER_MEBIBYTE: int = 1024 * 1024


async def read_mongodb_collection_storage_bytes(
    database: Any,
    collection_name: str,
) -> tuple[int, int, int]:
    """
    Return ``(logical_document_bytes, storage_allocation_bytes, total_index_bytes)``
    from MongoDB ``collStats`` for the given collection.

    ``logical_document_bytes`` maps to BSON ``size`` (uncompressed document payload).
    ``storage_allocation_bytes`` maps to ``storageSize`` (on-disk allocation for data).
    ``total_index_bytes`` maps to ``totalIndexSize``.

    If the command is unavailable (permissions, in-memory test doubles, etc.), returns
    three zeros without raising.
    """
    if not collection_name:
        return (0, 0, 0)
    try:
        stats: dict[str, Any] = await database.command({"collStats": collection_name})
    except Exception as exc:
        logger.debug("MongoDB collStats skipped for %r: %s", collection_name, exc)
        return (0, 0, 0)
    logical_document_bytes = int(stats.get("size") or 0)
    storage_allocation_bytes = int(stats.get("storageSize") or 0)
    total_index_bytes = int(stats.get("totalIndexSize") or 0)
    return (logical_document_bytes, storage_allocation_bytes, total_index_bytes)


# ── Jinja2 Template Filters ────────────────────────────────────────────────


def register_admin_template_filters(jinja_env) -> None:
    """Register custom filters on the admin Jinja2 Environment."""
    jinja_env.filters["nice_title"] = _filter_nice_title
    jinja_env.filters["humanize_label"] = _filter_humanize_label
    jinja_env.filters["filesize"] = _filter_filesize
    jinja_env.filters["tojson"] = _filter_tojson


def _filter_nice_title(value: Any) -> str:
    """Title-case field names and simple labels (not whole emails or arbitrary dicts)."""
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    return text.replace("_", " ").title()


def _filter_humanize_label(value: Any) -> str:
    """Pretty enum / status values for tables (e.g. ``admin`` → ``Admin``, not ``UserRole.ADMIN``)."""
    if value is None:
        return "—"
    if isinstance(value, Enum):
        label_source = str(value.value)
    else:
        label_source = str(value).strip()
    if not label_source:
        return "—"
    if label_source.startswith("UserRole."):
        suffix = label_source.split(".", 1)[-1]
        label_source = suffix.lower()
    return label_source.replace("_", " ").title()


def _filter_filesize(value: Any) -> str:
    try:
        size_bytes = float(value)
    except (TypeError, ValueError):
        return str(value) if value else "—"

    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(size_bytes) < 1024.0:
            return f"{int(size_bytes)} {unit}" if unit == "B" else f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} PB"


def _filter_tojson(value: Any, indent: int | None = None) -> str:
    return json.dumps(value, default=str, indent=indent)
