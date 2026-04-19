"""
* backbone/core/enums.py
? All Backbone-wide enumerations.
"""

from enum import Enum


class UserRole(str, Enum):
    USER = "user"
    STAFF = "staff"
    ADMIN = "admin"
    SUPERUSER = "superuser"


class TaskStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EmailStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


class LogLevel(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class SortDirection(int, Enum):
    ASCENDING = 1
    DESCENDING = -1
