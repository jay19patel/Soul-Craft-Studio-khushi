"""
* backbone/web/routers/admin/media_upload.py
? JSON API for admin Attachment uploads (multipart file or image URL).
  Used by ``backbone/templates/admin/model_create.html`` (overridable via ``templates/admin/``) for the Attachment create flow.
"""

import logging
from beanie import Document
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from backbone.domain.models import Attachment, User
from backbone.web.routers.admin.helpers import (
    build_beanie_link_from_object_id_string,
    download_https_url_and_save_as_attachment,
    save_uploaded_file_as_attachment,
)
from backbone.web.routers.admin.views import resolve_admin_user_from_cookie

logger = logging.getLogger("backbone.web.routers.admin.media_upload")

router = APIRouter(tags=["Admin Media"])


class MediaUploadResponse(BaseModel):
    """Successful upload payload returned to the admin UI."""

    id: str
    filename: str
    file_path: str | None
    content_type: str


async def require_admin_user_for_media_api(request: Request) -> User:
    admin_user = await resolve_admin_user_from_cookie(request)
    if not admin_user:
        raise HTTPException(status_code=401, detail="Admin login required.")
    return admin_user


def _find_document_model_by_collection_hint(collection_hint: str) -> type[Document] | None:
    from backbone.admin.site import admin_site

    for model_config in admin_site.get_all_registered_models():
        model_class = model_config["model"]
        settings_name = getattr(getattr(model_class, "Settings", None), "name", None)
        if collection_hint in (
            model_class.__name__,
            model_class.__name__.lower(),
            settings_name,
        ):
            return model_class
    return None


async def _try_attach_to_parent_document(
    *,
    attachment: Attachment,
    collection_name: str,
    document_id: str,
    field_name: str,
) -> None:
    target_model = _find_document_model_by_collection_hint(collection_name.strip())
    if not target_model:
        logger.warning("Unknown collection for attachment link: %s", collection_name)
        return

    target_document = await target_model.get(document_id.strip())
    if not target_document:
        logger.warning(
            "Document not found for attachment link: %s %s", collection_name, document_id
        )
        return

    field_key = field_name.strip()
    if not hasattr(target_document, field_key):
        logger.warning("Field %s missing on %s", field_key, target_model.__name__)
        return

    link_to_attachment = build_beanie_link_from_object_id_string(Attachment, str(attachment.id))
    setattr(target_document, field_key, link_to_attachment)
    await target_document.save()


@router.post("/media/upload", response_model=MediaUploadResponse)
async def admin_upload_media_attachment(
    admin_user: User = Depends(require_admin_user_for_media_api),
    file: UploadFile | None = File(default=None),
    url: str | None = Form(default=None),
    collection_name: str | None = Form(default=None),
    document_id: str | None = Form(default=None),
    field_name: str | None = Form(default=None),
) -> MediaUploadResponse:
    """
    Accept either a multipart file or a remote image URL, persist under MEDIA_ROOT,
    and create an Attachment. Optional linking fields update a target document
    when all three are provided and the field is a Link to Attachment.
    """
    _ = admin_user

    has_file = file is not None and bool(getattr(file, "filename", None))
    has_url = bool(url and url.strip())

    if has_file == has_url:
        raise HTTPException(
            status_code=400,
            detail="Send exactly one of: file (multipart) or url (form field).",
        )

    attachment_id: str | None = None

    if has_file:
        assert file is not None
        attachment_id = await save_uploaded_file_as_attachment(file)
    else:
        assert url is not None
        try:
            attachment_id = await download_https_url_and_save_as_attachment(url.strip())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not attachment_id:
        raise HTTPException(status_code=500, detail="Failed to create attachment.")

    saved_attachment = await Attachment.get(attachment_id)
    if not saved_attachment:
        raise HTTPException(status_code=500, detail="Attachment record missing after insert.")

    if collection_name and document_id and field_name:
        try:
            await _try_attach_to_parent_document(
                attachment=saved_attachment,
                collection_name=collection_name,
                document_id=document_id,
                field_name=field_name,
            )
        except Exception as exc:
            logger.error("Optional attachment link failed: %s", exc, exc_info=True)

    return MediaUploadResponse(
        id=str(saved_attachment.id),
        filename=saved_attachment.filename,
        file_path=saved_attachment.file_path,
        content_type=saved_attachment.content_type,
    )
