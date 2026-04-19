"""
Backbone FastAPI — Class-based views, DRF-style permissions,
auto-admin, background tasks, cron scheduler, and email
for MongoDB-backed FastAPI applications.

Quick start::

    from fastapi import FastAPI
    from backbone import setup_backbone, GenericCrudView
    from backbone.domain.base import AuditDocument

    app = FastAPI()
    setup_backbone(app, models=[MyModel])

    class MyView(GenericCrudView):
        model = MyModel
        search_fields = ["title"]

    app.include_router(MyView.as_router(prefix="/api/items"))
"""

from backbone.admin.site import ModelAdmin, admin_site
from backbone.config import BackboneSettings, settings
from backbone.core.exceptions import (
    AuthenticationException,
    BackboneException,
    ConflictException,
    EmailNotVerifiedException,
    NotFoundException,
    PermissionException,
    ServiceException,
    ValidationException,
)
from backbone.core.initializer import setup_backbone
from backbone.core.signals import signals
from backbone.domain.base import AuditDocument, BackboneDocument
from backbone.services.cache import cache_service
from backbone.services.mail import mail_service
from backbone.services.scheduler import scheduler
from backbone.services.tasks import BackboneWorker, task_service
from backbone.web.generic.views import (
    GenericCreateView,
    GenericCrudView,
    GenericListView,
    GenericRetrieveView,
)
from backbone.web.permissions.base import (
    AllowAny,
    BasePermission,
    IsAdminUser,
    IsAuthenticated,
    IsOwner,
    IsStaffUser,
    IsSuperUser,
)

__version__ = "3.1.0"

__all__ = [
    # App bootstrap
    "setup_backbone",
    # Class-based views
    "GenericCrudView",
    "GenericCreateView",
    "GenericListView",
    "GenericRetrieveView",
    # Document bases
    "AuditDocument",
    "BackboneDocument",
    # Permissions
    "AllowAny",
    "BasePermission",
    "IsAdminUser",
    "IsAuthenticated",
    "IsOwner",
    "IsStaffUser",
    "IsSuperUser",
    # Admin
    "admin_site",
    "ModelAdmin",
    # Signals
    "signals",
    # Exceptions
    "BackboneException",
    "NotFoundException",
    "ValidationException",
    "ConflictException",
    "AuthenticationException",
    "PermissionException",
    "EmailNotVerifiedException",
    "ServiceException",
    # Services
    "task_service",
    "BackboneWorker",
    "scheduler",
    "mail_service",
    "cache_service",
    # Config
    "BackboneSettings",
    "settings",
]
