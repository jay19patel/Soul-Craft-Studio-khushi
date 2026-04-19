"""
* backbone/web/routers/admin/views.py
? Admin UI HTML routes: dashboard, login/logout, model CRUD,
  JSON search API for linked-field dropdowns.
"""

import asyncio
import logging
import math
import os
import json
import tempfile
import urllib.parse
from datetime import UTC, datetime
from enum import Enum
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, FileResponse
from fastapi.templating import Jinja2Templates
from jinja2 import ChoiceLoader, FileSystemLoader
from pydantic import ValidationError

from backbone.admin.site import admin_site
from backbone.config import settings
from backbone.core.database import get_motor_client
from backbone.core.enums import UserRole
from backbone.domain.models import User
from backbone.utils.security import PasswordManager, TokenManager
from backbone.web.routers.admin.helpers import (
    ADMIN_TEMPLATE_INTERNAL_FIELD_NAMES,
    BYTES_PER_MEBIBYTE,
    collect_all_model_fields,
    discover_link_fields,
    get_displayable_field_names,
    parse_admin_form_data,
    read_mongodb_collection_storage_bytes,
    register_admin_template_filters,
)

logger = logging.getLogger("backbone.web.routers.admin.views")

router = APIRouter(prefix=settings.ADMIN_PREFIX, tags=["Admin"])

# ── Template Setup ─────────────────────────────────────────────────────────


def _build_admin_templates() -> Jinja2Templates:
    """
    Build a Jinja2 environment that looks in:
      1. <cwd>/templates/admin  (user overrides)
      2. backbone/templates/admin  (library defaults)
    """
    user_admin_path = settings.user_templates_path / "admin"
    backbone_admin_path = settings.backbone_templates_path / "admin"

    search_paths = [
        p for p in (str(user_admin_path), str(backbone_admin_path)) if os.path.exists(p)
    ]
    # ? Fall back to relative path for backward compatibility
    if not search_paths:
        search_paths = [str(settings.user_templates_path / "admin")]

    loader = ChoiceLoader([FileSystemLoader(p) for p in search_paths])
    env = Jinja2Templates(directory=search_paths[0])
    env.env.loader = loader
    env.env.globals["admin_site"] = admin_site
    env.env.globals["internal_fields"] = ADMIN_TEMPLATE_INTERNAL_FIELD_NAMES
    register_admin_template_filters(env.env)
    return env


templates = _build_admin_templates()


# ── Admin Auth Dependency ──────────────────────────────────────────────────


async def resolve_admin_user_from_cookie(request: Request) -> User | None:
    """Resolve the admin user from the admin_session cookie."""
    session_token = request.cookies.get("admin_session")
    if not session_token:
        return None

    payload = TokenManager.decode_token(session_token)
    if not payload:
        return None

    user_id = payload.get("sub")
    user = await User.get(user_id)
    if not user or user.role not in (UserRole.ADMIN, UserRole.SUPERUSER):
        return None
    try:
        await user.fetch_all_links()
    except Exception:
        logger.debug(
            "fetch_all_links failed for admin session user %s",
            user_id,
            exc_info=True,
        )
    return user


def _redirect_to_login() -> RedirectResponse:
    return RedirectResponse(url=f"{settings.ADMIN_PREFIX}/login")


# ── Dashboard ──────────────────────────────────────────────────────────────


@router.get("/", response_class=HTMLResponse)
async def admin_dashboard(
    request: Request,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    if not admin_user:
        return _redirect_to_login()

    registered_models = admin_site.get_all_registered_models()
    model_stats = await _collect_model_document_counts(registered_models)
    database_summary_stats = _build_dashboard_database_summary(
        registered_models,
        model_stats,
    )

    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "user": admin_user,
            "models": registered_models,
            "pages": admin_site.get_all_registered_pages(),
            "model_stats": model_stats,
            "db_stats": database_summary_stats,
            "now": datetime.now(UTC),
        },
    )


async def _collect_model_document_counts(
    registered_models: list[Any],
) -> dict[str, dict[str, float | int]]:
    """
    Per-model document counts plus storage from MongoDB ``collStats`` (when Motor is connected).

    Each entry includes:

    - ``count`` — ``Document.count()`` for the model.
    - ``data_size_mb`` — logical BSON payload size (``collStats.size``).
    - ``size_mb`` — on-disk footprint for data + indexes (``storageSize`` + ``totalIndexSize``).
    - ``storage_raw_mb`` — data file allocation only (``storageSize``).
    - ``index_mb`` — index footprint only (``totalIndexSize``).
    """
    stats: dict[str, dict[str, float | int]] = {}
    motor_client = get_motor_client()
    mongo_database = motor_client[settings.DATABASE_NAME] if motor_client is not None else None

    for model_config in registered_models:
        model = model_config["model"]
        model_name = model_config["name"]
        try:
            document_count = await model.count()
        except Exception:
            document_count = 0

        logical_bytes = 0
        storage_bytes = 0
        index_bytes = 0
        if mongo_database is not None:
            try:
                collection_name = model.get_collection_name()
            except Exception:
                collection_name = ""
            if collection_name:
                (
                    logical_bytes,
                    storage_bytes,
                    index_bytes,
                ) = await read_mongodb_collection_storage_bytes(
                    mongo_database,
                    collection_name,
                )

        logical_mebibytes = logical_bytes / BYTES_PER_MEBIBYTE
        storage_mebibytes = storage_bytes / BYTES_PER_MEBIBYTE
        index_mebibytes = index_bytes / BYTES_PER_MEBIBYTE
        stats[model_name] = {
            "count": document_count,
            "data_size_mb": logical_mebibytes,
            "size_mb": storage_mebibytes + index_mebibytes,
            "storage_raw_mb": storage_mebibytes,
            "index_mb": index_mebibytes,
        }
    return stats


def _build_dashboard_database_summary(
    registered_models: list[Any],
    model_stats: dict[str, Any],
) -> dict[str, float | int]:
    """
    Aggregate dashboard card values to match ``dashboard.html``.

    ``total_size_mb`` sums per-model on-disk footprint (data allocation + indexes).
    ``data_size_mb`` sums logical BSON sizes. ``storage_size_mb`` / ``index_size_mb`` split the disk part.
    """
    model_names = [entry["name"] for entry in registered_models]
    total_documents = sum(
        int((model_stats.get(name, {}) or {}).get("count", 0)) for name in model_names
    )
    total_logical_mebibytes = sum(
        float((model_stats.get(name, {}) or {}).get("data_size_mb", 0.0)) for name in model_names
    )
    total_disk_mebibytes = sum(
        float((model_stats.get(name, {}) or {}).get("size_mb", 0.0)) for name in model_names
    )
    total_storage_mebibytes = sum(
        float((model_stats.get(name, {}) or {}).get("storage_raw_mb", 0.0)) for name in model_names
    )
    total_index_mebibytes = sum(
        float((model_stats.get(name, {}) or {}).get("index_mb", 0.0)) for name in model_names
    )
    return {
        "total_models": len(registered_models),
        "total_documents": total_documents,
        "total_size_mb": total_disk_mebibytes,
        "data_size_mb": total_logical_mebibytes,
        "storage_size_mb": total_storage_mebibytes,
        "index_size_mb": total_index_mebibytes,
    }


# ── Login / Logout ─────────────────────────────────────────────────────────


@router.get("/login", response_class=HTMLResponse)
async def admin_login_page(request: Request):
    return templates.TemplateResponse(request, "login.html", {"error": None})


@router.post("/login")
async def handle_admin_login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
):
    from backbone.services.auth import AuthService

    auth_service = AuthService()

    user = await auth_service.find_user_by_email(email)
    is_valid_password = user and PasswordManager.verify_password(password, user.hashed_password)

    if not user or not is_valid_password or user.role not in (UserRole.ADMIN, UserRole.SUPERUSER):
        return templates.TemplateResponse(
            request,
            "login.html",
            {"error": "Access denied. Admin credentials required."},
        )

    session_tokens = await auth_service.create_user_session(user)
    response = RedirectResponse(url=settings.ADMIN_PREFIX, status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        key="admin_session",
        value=session_tokens["access_token"],
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )
    return response


@router.get("/logout")
async def admin_logout():
    response = RedirectResponse(url=f"{settings.ADMIN_PREFIX}/login")
    response.delete_cookie("admin_session")
    return response


# ── Search API (must be before /{model_name} or "api" is captured as a model) ─


@router.get("/api/search/{model_name}")
async def admin_search_api(
    model_name: str,
    q: str = "",
    page: int = 1,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    """JSON endpoint for linked-field autocomplete searches in admin forms."""
    if not admin_user:
        raise HTTPException(status_code=401)

    model_config = admin_site.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=404)

    model = model_config["model"]
    page_size = 20
    skip = (page - 1) * page_size

    search_mongo_query = _build_admin_text_search_query(q, model)
    total_count = await model.find(search_mongo_query).count()
    documents = await model.find(search_mongo_query).skip(skip).limit(page_size).to_list()

    results = []
    for doc in documents:
        res = {"id": str(doc.id), "text": _resolve_display_text(doc)}
        # ? If the document has a file_path (Attachments), include it for admin previews
        if hasattr(doc, "file_path") and doc.file_path:
            res["image"] = doc.file_path
        results.append(res)

    return {
        "results": results,
        "total_count": total_count,
        "page": page,
        "total_pages": math.ceil(total_count / page_size) if page_size else 1,
    }


# ── Model Create (must be before /{model_name}/{pk} or "create" is treated as pk) ─


@router.get("/{model_name}/create", response_class=HTMLResponse)
async def admin_model_create_page(
    request: Request,
    model_name: str,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    if not admin_user:
        return _redirect_to_login()

    model_config = admin_site.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=404)

    return templates.TemplateResponse(
        request,
        "model_create.html",
        {
            "user": admin_user,
            "model_name": model_name,
            "model_fields": collect_all_model_fields(model_config["model"]),
            "field_links": discover_link_fields(model_config["model"], admin_site._model_registry),
            "models": admin_site.get_all_registered_models(),
            "now": datetime.now(UTC),
        },
    )


@router.post("/{model_name}/create")
async def handle_admin_model_create(
    request: Request,
    model_name: str,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    if not admin_user:
        return _redirect_to_login()

    model_config = admin_site.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=404)

    model = model_config["model"]
    model_fields = collect_all_model_fields(model)
    parsed_form_data = await parse_admin_form_data(request, model_fields)

    try:
        new_instance = model(**parsed_form_data)
        await new_instance.insert()
        return RedirectResponse(
            url=f"{settings.ADMIN_PREFIX}/{model_name}",
            status_code=status.HTTP_303_SEE_OTHER,
        )
    except ValidationError as exc:
        # ? Format Pydantic errors: "email: value is not a valid email address"
        details = " | ".join([f"{e['loc'][-1]}: {e['msg']}" for e in exc.errors()])
        logger.warning("Validation failed for %s: %s", model_name, details)
        return RedirectResponse(
            url=f"{settings.ADMIN_PREFIX}/{model_name}/create?error=ValidationFailed&detail={urllib.parse.quote(details)}",
            status_code=status.HTTP_303_SEE_OTHER,
        )
    except Exception as exc:
        logger.error("Failed to create %s: %s", model_name, exc)
        return RedirectResponse(
            url=f"{settings.ADMIN_PREFIX}/{model_name}/create?error=SaveFailed&detail={urllib.parse.quote(str(exc))}",
            status_code=status.HTTP_303_SEE_OTHER,
        )


# ── Model Delete (before /{model_name}/{pk} so literal path segment wins) ───


@router.get("/{model_name}/{pk}/delete")
async def handle_admin_model_delete(
    request: Request,
    model_name: str,
    pk: str,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    if not admin_user:
        return _redirect_to_login()

    model_config = admin_site.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=404)

    document = await model_config["model"].get(pk)
    if not document:
        raise HTTPException(status_code=404)

    await document.delete()
    return RedirectResponse(
        url=f"{settings.ADMIN_PREFIX}/{model_name}",
        status_code=status.HTTP_303_SEE_OTHER,
    )


# ── Framework settings (must be before ``/{model_name}`` or "config" is treated as a model) ─

_ADMIN_CONFIG_SECRET_KEYS = frozenset({"SECRET_KEY", "EMAIL_PASSWORD"})


def _read_dotenv_file_key_names_normalized() -> set[str]:
    """Return lowercase keys found in the project root ``.env`` file (no values parsed)."""
    env_file_path = Path.cwd() / ".env"
    if not env_file_path.is_file():
        return set()
    normalized_key_names: set[str] = set()
    try:
        file_text = env_file_path.read_text(encoding="utf-8")
    except OSError:
        return set()
    for raw_line in file_text.splitlines():
        stripped_line = raw_line.strip()
        if not stripped_line or stripped_line.startswith("#"):
            continue
        if stripped_line.startswith("export "):
            stripped_line = stripped_line[7:].strip()
        if "=" not in stripped_line:
            continue
        variable_name = stripped_line.split("=", 1)[0].strip().strip('"').strip("'")
        if variable_name:
            normalized_key_names.add(variable_name.lower())
    return normalized_key_names


def _python_value_type_label_for_config(value: Any) -> str:
    """Short type badge for the config table (matches template filter options)."""
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int) and not isinstance(value, bool):
        return "int"
    if isinstance(value, float):
        return "float"
    return "str"


def _build_backbone_settings_config_entries() -> tuple[list[SimpleNamespace], int, int]:
    """
    Build rows for the admin config UI: value, type badge, optional Field description,
    whether the key appears in ``.env``, and masked secrets.
    """
    from backbone.config import BackboneSettings

    dotenv_key_names_lower = _read_dotenv_file_key_names_normalized()
    json_friendly_values = settings.model_dump(mode="json")
    python_values = settings.model_dump(mode="python")
    config_entries: list[SimpleNamespace] = []

    for field_name in sorted(json_friendly_values.keys()):
        json_value = json_friendly_values[field_name]
        python_value = python_values.get(field_name)
        field_info = BackboneSettings.model_fields.get(field_name)
        description_text = (
            field_info.description if field_info and field_info.description else ""
        ) or ""

        is_sensitive_field = field_name in _ADMIN_CONFIG_SECRET_KEYS
        if is_sensitive_field and json_value not in (None, "", False):
            display_value = "••••••••"
        else:
            display_value = json_value

        from_dotenv_file = field_name.lower() in dotenv_key_names_lower
        type_label = _python_value_type_label_for_config(python_value)

        config_entries.append(
            SimpleNamespace(
                key=field_name,
                value=display_value,
                type=type_label,
                from_env=from_dotenv_file,
                description=description_text,
                is_sensitive=is_sensitive_field,
            ),
        )

    environment_sourced_count = sum(1 for row in config_entries if row.from_env)
    default_sourced_count = len(config_entries) - environment_sourced_count
    return config_entries, environment_sourced_count, default_sourced_count


@router.get("/config", response_class=HTMLResponse)
async def admin_backbone_settings_page(
    request: Request,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    """Read-only view of ``BackboneSettings`` for operators (secrets masked)."""
    if not admin_user:
        return _redirect_to_login()
    if admin_user.role not in (UserRole.ADMIN, UserRole.SUPERUSER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")

    config_entries, environment_sourced_count, default_sourced_count = (
        _build_backbone_settings_config_entries()
    )

    return templates.TemplateResponse(
        request,
        "config.html",
        {
            "user": admin_user,
            "entries": config_entries,
            "env_count": environment_sourced_count,
            "default_count": default_sourced_count,
            "models": admin_site.get_all_registered_models(),
            "now": datetime.now(UTC),
        },
    )


# ── Export / Import / Wipe ──────────────────────────────────────────────────


@router.get("/export")
async def handle_admin_data_export(
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    """
    Export all documents from all registered models as a JSON file.
    Identifies each collection by its registered model name.
    """
    if not admin_user:
        return _redirect_to_login()

    export_payload: dict[str, list[dict]] = {}
    registered_models = admin_site.get_all_registered_models()

    for model_config in registered_models:
        model = model_config["model"]
        model_name = model_config["name"]
        try:
            # ? We use find_all() to fetch everything for this collection
            documents = await model.find_all().to_list()
            # ? Use mode="json" so ObjectIds and Datetimes are automatically converted to strings
            export_payload[model_name] = [doc.model_dump(mode="json") for doc in documents]
        except Exception as exc:
            logger.error("Export failed for model %s: %s", model_name, exc)
            export_payload[model_name] = []

    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    safe_app_name = settings.APP_NAME.lower().replace(" ", "_")
    filename = f"{safe_app_name}_export_{timestamp}.json"

    # ? Package payload as JSON bytes for download
    json_bytes = json.dumps(export_payload, indent=2, default=str).encode("utf-8")

    from fastapi import Response

    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/import", response_class=HTMLResponse)
async def admin_import_page(
    request: Request,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    """Render the JSON data import upload page."""
    if not admin_user:
        return _redirect_to_login()

    return templates.TemplateResponse(
        request,
        "import.html",
        {
            "user": admin_user,
            "models": admin_site.get_all_registered_models(),
            "now": datetime.now(UTC),
        },
    )


@router.post("/import")
async def handle_admin_data_import(
    request: Request,
    file: UploadFile = File(...),
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    """
    Process an uploaded JSON export. Matches model names to registered Beanie models
    and performs an upsert (save) for every document.
    """
    if not admin_user:
        return _redirect_to_login()

    try:
        raw_content = await file.read()
        import_data = json.loads(raw_content)
    except Exception as exc:
        logger.warning("Import file parse failed: %s", exc)
        return templates.TemplateResponse(
            request,
            "import.html",
            {
                "user": admin_user,
                "error": f"Failed to parse JSON file: {str(exc)}",
                "models": admin_site.get_all_registered_models(),
                "now": datetime.now(UTC),
            },
        )

    if not isinstance(import_data, dict):
        return templates.TemplateResponse(
            request,
            "import.html",
            {
                "user": admin_user,
                "error": "Invalid import format. Expected a JSON object with model names as keys.",
                "models": admin_site.get_all_registered_models(),
                "now": datetime.now(UTC),
            },
        )

    summary: dict[str, dict[str, int | str]] = {}

    for model_name, document_list in import_data.items():
        model_config = admin_site.get_model_config(model_name)
        if not model_config:
            summary[model_name] = {"status": "skipped", "reason": "Model not registered"}
            continue

        if not isinstance(document_list, list):
            summary[model_name] = {"status": "skipped", "reason": "Expected a list of documents"}
            continue

        model = model_config["model"]
        upserted_count = 0
        failed_count = 0

        for doc_raw in document_list:
            try:
                # ? Beanie save() handles upsert if _id is present.
                #   We ensure '_id' is correctly typed if it looks like an ObjectId string.
                if "_id" in doc_raw and isinstance(doc_raw["_id"], str):
                    try:
                        doc_raw["_id"] = ObjectId(doc_raw["_id"])
                    except Exception:
                        pass  # Keep as string if it's not a valid ObjectId hex

                instance = model(**doc_raw)
                await instance.save()
                upserted_count += 1
            except Exception as exc:
                logger.error("Upsert failed for %s doc: %s", model_name, exc)
                failed_count += 1

        summary[model_name] = {"inserted": upserted_count, "skipped": failed_count}

    return templates.TemplateResponse(
        request,
        "import.html",
        {
            "user": admin_user,
            "summary": summary,
            "models": admin_site.get_all_registered_models(),
            "now": datetime.now(UTC),
        },
    )


@router.get("/wipe", response_class=HTMLResponse)
async def admin_wipe_page(
    request: Request,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    """Main danger-zone page for clearing the entire database."""
    if not admin_user:
        return _redirect_to_login()

    return templates.TemplateResponse(
        request,
        "wipe.html",
        {
            "user": admin_user,
            "models": admin_site.get_all_registered_models(),
            "now": datetime.now(UTC),
        },
    )


@router.post("/wipe")
async def handle_admin_wipe(
    request: Request,
    password: str = Form(...),
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    """
    Permanently deletes all records from all registered collections.
    Requires password confirmation and Superuser role.
    """
    if not admin_user:
        return _redirect_to_login()

    # ? Safety: Verify password before dropping data
    if not PasswordManager.verify_password(password, admin_user.hashed_password):
        return templates.TemplateResponse(
            request,
            "wipe.html",
            {
                "user": admin_user,
                "error": "Confirmation failed: Invalid administrator password.",
                "models": admin_site.get_all_registered_models(),
                "now": datetime.now(UTC),
            },
        )

    # ? Keep a copy of the admin to restore they don't lose session
    admin_data = admin_user.model_dump()
    if "_id" in admin_data:
        del admin_data["_id"]

    registered_models = admin_site.get_all_registered_models()
    for model_config in registered_models:
        model = model_config["model"]
        try:
            await model.delete_all()
        except Exception as exc:
            logger.error("Wipe failed for %s: %s", model_config["name"], exc)

    # ? Re-seed the current superuser so we can continue the session
    try:
        new_admin = User(**admin_data)
        new_admin.id = admin_user.id
        await new_admin.insert()
    except Exception as exc:
        logger.critical("Failed to restore admin user after wipe! %s", exc)

    return RedirectResponse(
        url=f"{settings.ADMIN_PREFIX}/?success=Database+Permanently+Wiped",
        status_code=status.HTTP_303_SEE_OTHER,
    )


@router.post("/clear-database")
async def handle_admin_clear_database_shortcut(
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    """
    Shortcut POST from the quick-clear modal (no password required).
    """
    if not admin_user:
        return _redirect_to_login()

    # ? Simple wipe logic
    registered_models = admin_site.get_all_registered_models()
    for model_config in registered_models:
        model = model_config["model"]
        try:
            await model.delete_all()
        except Exception:
            pass

    # Restore current user
    admin_user.id = ObjectId(admin_user.id) if isinstance(admin_user.id, str) else admin_user.id
    await admin_user.insert()

    return RedirectResponse(
        url=f"{settings.ADMIN_PREFIX}/?success=Database+Cleared",
        status_code=status.HTTP_303_SEE_OTHER,
    )


# ── Model List ─────────────────────────────────────────────────────────────


@router.get("/{model_name}", response_class=HTMLResponse)
async def admin_model_list(
    request: Request,
    model_name: str,
    page: int = 1,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    if not admin_user:
        return _redirect_to_login()

    model_config = admin_site.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=404)

    model = model_config["model"]
    page_size = int(request.query_params.get("page_size", 20))
    search_query_text = request.query_params.get("q", "")
    search_field = request.query_params.get("search_field", "all")
    sort_by = request.query_params.get("sort_by", "_id")
    sort_order = request.query_params.get("order", "desc")
    skip_count = (page - 1) * page_size

    mongo_query = _build_admin_search_query(search_query_text, search_field)
    sort_direction = -1 if sort_order == "desc" else 1
    total_document_count = await model.find(mongo_query).count()
    raw_documents = (
        await model.find(mongo_query)
        .sort([(sort_by, sort_direction)])
        .skip(skip_count)
        .limit(page_size)
        .to_list()
    )

    field_links_for_list = discover_link_fields(model, admin_site._model_registry)
    serialized_items = await asyncio.gather(
        *[
            _serialize_document_with_attachment_previews(doc, field_links_for_list)
            for doc in raw_documents
        ],
    )
    total_pages = math.ceil(total_document_count / page_size) if page_size else 1

    return templates.TemplateResponse(
        request,
        "model_list.html",
        {
            "user": admin_user,
            "model_name": model_name,
            "items": list(serialized_items),
            "total_count": total_document_count,
            "current_page": page,
            "total_pages": total_pages,
            "page_size": page_size,
            "page_size_options": [10, 20, 50, 100],
            "search_query": search_query_text,
            "active_search_field": search_field,
            "active_sort_field": sort_by,
            "active_sort_order": sort_order,
            "search_fields": get_displayable_field_names(model),
            "display_fields": get_displayable_field_names(model),
            "model_fields": collect_all_model_fields(model),
            "field_links": field_links_for_list,
            "models": admin_site.get_all_registered_models(),
            "now": datetime.now(UTC),
        },
    )


# ── Model Detail ───────────────────────────────────────────────────────────


@router.get("/{model_name}/{pk}", response_class=HTMLResponse)
async def admin_model_detail(
    request: Request,
    model_name: str,
    pk: str,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    if not admin_user:
        return _redirect_to_login()

    model_config = admin_site.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=404)

    document = await model_config["model"].get(pk)
    if not document:
        raise HTTPException(status_code=404)

    try:
        await document.fetch_all_links()
    except Exception:
        logger.debug(
            "fetch_all_links skipped or failed for %s/%s",
            model_name,
            pk,
            exc_info=True,
        )

    field_links_for_detail = discover_link_fields(model_config["model"], admin_site._model_registry)
    serialized_item = await _serialize_document_with_attachment_previews(
        document, field_links_for_detail
    )

    return templates.TemplateResponse(
        request,
        "model_detail.html",
        {
            "user": admin_user,
            "model_name": model_name,
            "item": serialized_item,
            "model_fields": collect_all_model_fields(model_config["model"]),
            "field_links": field_links_for_detail,
            "models": admin_site.get_all_registered_models(),
            "now": datetime.now(UTC),
        },
    )


# ── Delete all rows for a model (before POST ``/{model_name}/{pk}`` or ``delete_all`` is parsed as pk) ─


@router.post("/{model_name}/delete_all")
async def handle_admin_model_delete_all(
    request: Request,
    model_name: str,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    if not admin_user:
        return _redirect_to_login()

    model_config = admin_site.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=404)

    model = model_config["model"]
    try:
        await model.delete_all()
    except Exception as exc:
        logger.error("delete_all failed for %s: %s", model_name, exc, exc_info=True)
        return RedirectResponse(
            url=f"{settings.ADMIN_PREFIX}/{model_name}?error=DeleteAllFailed&detail={urllib.parse.quote(str(exc))}",
            status_code=status.HTTP_303_SEE_OTHER,
        )

    return RedirectResponse(
        url=f"{settings.ADMIN_PREFIX}/{model_name}",
        status_code=status.HTTP_303_SEE_OTHER,
    )


# ── Model Update ───────────────────────────────────────────────────────────


@router.post("/{model_name}/{pk}")
async def handle_admin_model_update(
    request: Request,
    model_name: str,
    pk: str,
    admin_user: User | None = Depends(resolve_admin_user_from_cookie),
):
    if not admin_user:
        return _redirect_to_login()

    model_config = admin_site.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=404)

    document = await model_config["model"].get(pk)
    if not document:
        raise HTTPException(status_code=404)

    model_fields = collect_all_model_fields(model_config["model"])
    parsed_form_data = await parse_admin_form_data(request, model_fields)

    for field_name, field_value in parsed_form_data.items():
        setattr(document, field_name, field_value)

    try:
        await document.save()
        return RedirectResponse(
            url=f"{settings.ADMIN_PREFIX}/{model_name}/{pk}",
            status_code=status.HTTP_303_SEE_OTHER,
        )
    except ValidationError as exc:
        details = " | ".join([f"{e['loc'][-1]}: {e['msg']}" for e in exc.errors()])
        logger.warning("Validation failed for %s/%s: %s", model_name, pk, details)
        return RedirectResponse(
            url=f"{settings.ADMIN_PREFIX}/{model_name}/{pk}?error=ValidationFailed&detail={urllib.parse.quote(details)}",
            status_code=status.HTTP_303_SEE_OTHER,
        )
    except Exception as exc:
        logger.error("Failed to update %s/%s: %s", model_name, pk, exc)
        return RedirectResponse(
            url=f"{settings.ADMIN_PREFIX}/{model_name}/{pk}?error=UpdateFailed&detail={urllib.parse.quote(str(exc))}",
            status_code=status.HTTP_303_SEE_OTHER,
        )




# ── Private Helpers ────────────────────────────────────────────────────────


def _build_admin_search_query(search_text: str, search_field: str) -> dict:
    if not search_text:
        return {}
    if search_field == "all":
        return {
            "$or": [
                {"name": {"$regex": search_text, "$options": "i"}},
                {"title": {"$regex": search_text, "$options": "i"}},
                {"email": {"$regex": search_text, "$options": "i"}},
            ]
        }
    return {search_field: {"$regex": search_text, "$options": "i"}}


async def _serialize_document_with_attachment_previews(
    document: Any,
    field_links: dict[str, Any],
) -> dict:
    """
    Same as ``_serialize_document``, then loads ``Attachment`` rows for any
    ``Link[Attachment]`` preview missing ``file_path`` (Beanie often leaves links as DBRefs).
    """
    from backbone.domain.models import Attachment

    serialized_document = _serialize_document(document)

    async def fill_attachment_file_path_if_missing(preview_dict: dict) -> None:
        if not isinstance(preview_dict, dict):
            return
        if not preview_dict.get("id") or preview_dict.get("file_path"):
            return
        try:
            attachment_row = await Attachment.get(preview_dict["id"])
            if attachment_row:
                preview_dict["file_path"] = attachment_row.file_path
                preview_dict["filename"] = attachment_row.filename
        except Exception:
            logger.debug(
                "Could not load Attachment %s for admin preview",
                preview_dict.get("id"),
                exc_info=True,
            )

    for field_name, field_preview in list(serialized_document.items()):
        link_meta = field_links.get(field_name) if field_links else None
        if not link_meta or link_meta.get("model") != "Attachment":
            continue
        if link_meta.get("is_multi") and isinstance(field_preview, list):
            for nested_preview in field_preview:
                await fill_attachment_file_path_if_missing(nested_preview)
        elif isinstance(field_preview, dict):
            await fill_attachment_file_path_if_missing(field_preview)

    return serialized_document


def _build_admin_text_search_query(search_text: str, model) -> dict:
    if not search_text:
        return {}
    all_fields = collect_all_model_fields(model)
    search_conditions = []
    for field_name in ("name", "title", "email", "full_name"):
        if field_name in all_fields:
            search_conditions.append({field_name: {"$regex": search_text, "$options": "i"}})
    if search_conditions:
        return {"$or": search_conditions}
    try:
        return {"_id": ObjectId(search_text)}
    except Exception:
        return {}


def _serialize_document(document) -> dict:
    """Flatten a Beanie document for admin templates (Pydantic v2–safe, link-aware)."""
    from beanie.odm.fields import Link as LinkField

    dumped = document.model_dump(mode="python")

    def normalize_value(value: Any) -> Any:
        if isinstance(value, Enum):
            return getattr(value, "value", str(value))
        if isinstance(value, LinkField):
            return {
                "id": str(value.ref.id),
                "file_path": None,
                "filename": None,
            }
        if isinstance(value, dict):
            return {
                nested_key: normalize_value(nested_val) for nested_key, nested_val in value.items()
            }
        if isinstance(value, list):
            return [normalize_value(item) for item in value]
        return value

    serialized = normalize_value(dumped)
    if not isinstance(serialized, dict):
        serialized = {}
    serialized["id"] = str(document.id)

    for field_name, field_value in list(serialized.items()):
        raw_attr = getattr(document, field_name, None)
        if isinstance(raw_attr, LinkField):
            linked_doc = getattr(raw_attr, "document", None) or getattr(raw_attr, "_document", None)
            if linked_doc is not None and hasattr(linked_doc, "id"):
                preview: dict = {
                    "id": str(getattr(linked_doc, "id", "")),
                    "file_path": None,
                    "filename": None,
                }
                if hasattr(linked_doc, "file_path"):
                    preview["file_path"] = linked_doc.file_path
                if hasattr(linked_doc, "filename"):
                    preview["filename"] = linked_doc.filename
                serialized[field_name] = preview

    return serialized


def _resolve_display_text(document) -> str:
    for field_name in ("name", "title", "full_name", "email"):
        value = getattr(document, field_name, None)
        if value:
            return str(value)
    return str(document.id)
