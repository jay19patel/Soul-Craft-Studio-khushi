# Backbone FastAPI (CBV + MongoDB)

## 1. Project overview

Backbone is a **FastAPI application framework** for MongoDB-backed APIs. It combines:

- **Beanie** documents as the persistence model (ODM on Motor).
- **Class-based views** (`GenericCrudView`) that expose CRUD routes with hooks and a thin repository layer.
- **JWT authentication** with server-side **Session** records.
- A **Jinja2-based admin UI** for registered models (Django-admin–style ergonomics, not feature parity).
- Optional **Redis** helpers for cache and a simple task queue payload format.
- **SMTP mail** rendering via Jinja2 templates (optional, feature-flagged).

The repository root `main.py` currently includes a **demo** `TestProject` model and API to illustrate generic CRUD registration.

## 2. System architecture

High-level flow:

```text
HTTP (FastAPI)
    → Routers (web/routers/*, generic views)
        → Permission dependency (web/permissions)
        → Services (services/*) for cross-cutting workflows (auth, mail, tasks)
        → Repositories (repositories/base.py) → Beanie models (domain/*)
        → MongoDB (Motor)
```

Supporting components:

- **`config/settings.py`**: Pydantic Settings–driven configuration (env + `.env`).
- **`core/initializer.py`**: App wiring (CORS, static `/media`, routers, admin registration, startup DB init, admin user sync).
- **`core/database.py`**: Motor client + `init_beanie`.
- **`core/signals.py` + `domain/base.py`**: Post-insert/update/delete and coarse field-change emission on `AuditDocument`.
- **`core/admin_site.py`**: Singleton registry of models (and optional “pages”) for the admin UI.

## 3. Features

| Area | What exists today |
|------|---------------------|
| Auth API | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Sessions | Refresh token in HTTP-only cookie; access JWT encodes `sid` for session validation |
| Admin | HTML CRUD for registered models under `/admin`, separate cookie-based admin JWT |
| Public pages | Email verification status page, password reset request/confirm (token-based) |
| Generic API | `GenericCrudView.as_router(...)` for list/create/retrieve/patch/delete |
| Infra | Docker Compose for MongoDB + Redis; `vercel.json` present for deployment experiments |

## 4. Template overrides (admin + pages + email)

Backbone ships **default Jinja2 templates inside the package** and resolves **your copies under the project first** (the process current working directory), using the **same relative path** under `./templates/`:

| Area | Your override path (example) | Packaged fallback |
|------|------------------------------|-------------------|
| Admin HTML | `./templates/admin/login.html` | `backbone/templates/admin/` (`ChoiceLoader` in `backbone/web/routers/admin/views.py`) |
| Public pages | `./templates/pages/user_guide.html`, `./templates/pages/base_public.html`, `./templates/pages/auth/*.html` | `backbone/templates/pages/` (`ChoiceLoader` in `backbone/web/routers/pages.py`) |
| Transactional email | `./templates/email/welcome.html` | `backbone/templates/email/` (`backbone/services/mail.py`) |

Public routes use **`templates/`** as the first loader root (not `templates/pages/` alone), so paths in code look like `pages/user_guide.html`. Admin uses **`templates/admin/`** as the first root, so template names are filenames such as `model_list.html`. Mail loads **`templates/email/<name>.html`**. Override any default by adding a file with the **matching name and path segment**. Context variables for mail are documented on `MailService.send_*` methods; for HTML pages see the `TemplateResponse` calls in `backbone/web/routers/pages.py` and admin views.

The in-app **User Guide** (`/pages/user-guide`) includes a longer **Template overrides** section with examples for custom-only pages extending `pages/base_public.html`.

## 5. User workflows

### API consumer

1. **Register** → receives user payload (password hashed server-side).
2. **Login** → receives access token in JSON body; refresh token stored in cookie.
3. **Call protected routes** → `Authorization: Bearer <access>`; `get_current_user` validates JWT **and** active `Session` by `sid`.

### Admin operator

1. Open `/admin/login`, sign in as a user with `UserRole.ADMIN`.
2. Browse registered models, list/search, create/update/delete documents via forms.
3. File uploads in admin forms create `Attachment` rows and store files under `./media`.

### End user (password reset)

1. Submit email on `/pages/reset-password` (implementation currently does not send mail from the router; service returns a token payload).
2. Confirm new password on `/pages/reset-password/confirm` with token.

## 6. Module responsibilities

| Path | Responsibility |
|------|------------------|
| `main.py` | FastAPI app instance, demo model registration, example router mount |
| `config/settings.py` | Central configuration |
| `core/` | App bootstrap, DB, DI helpers, admin registry, enums, exceptions, signals |
| `domain/` | Beanie `Document` models and shared document bases (`AuditDocument`, `BackboneDocument`) |
| `repositories/` | Generic Beanie CRUD wrapper (`BaseRepository`) |
| `services/` | Auth, mail, Redis cache/task helpers |
| `schemas/` | Pydantic API schemas (currently mainly auth) |
| `web/generic/` | CBV mixins + `GenericCrudView` route factory |
| `web/permissions/` | DRF-style permission classes + `PermissionDependency` |
| `web/routers/` | Auth, admin HTML, public HTML pages |
| `templates/` (optional) | App-only overrides and extra templates; defaults live under `backbone/templates/` |
| `utils/` | Security helpers (hashing, JWT) |

## 7. Design decisions (current)

- **Repository pattern** for CRUD to keep view code smaller and swap persistence later if needed (today still Beanie-centric).
- **CBV + mixin lifecycle** (`before_*`, `perform_*`, `after_*`) for predictable extension points.
- **Soft delete** convention via `is_deleted` on `AuditDocument`; list mixin defaults to excluding deleted docs.
- **Signals** on `AuditDocument` for decoupled reactions (simple in-process dispatcher, not a message bus).
- **Settings as single source of truth** for secrets and integration toggles (email, cache, Redis).

## 8. Design patterns used

| Pattern | Where | Why |
|---------|--------|-----|
| **Repository** | `repositories/base.py` | Isolate persistence operations from HTTP layer |
| **Service layer** | `services/auth_service.py`, `services/mail_service.py` | Orchestrate use cases (login, session creation, mail send) |
| **Dependency injection** | FastAPI `Depends`, `PermissionDependency` | Testability and explicit request-scoped wiring |
| **Singleton** | `admin_site`, `signals`, module-level service instances | Global registries and shared dispatchers |
| **Template Method / Hooks** | Mixins in `web/generic/mixins.py` | Stable CRUD flow with override points |
| **Strategy (lightweight)** | Pluggable `permission_classes` on views | Vary authorization without changing route definitions |

## 9. Development setup

### Prerequisites

- Python **3.13+** (see `.python-version` / `pyproject.toml`)
- MongoDB (local or Docker)
- Optional: Redis (for cache/task helpers)

### Install

Using **uv** (recommended, lockfile present):

```bash
uv sync
```

Or pip:

```bash
pip install -r requirements.txt
```

### Environment

Copy `.env.example` to `.env` and set at minimum:

- `SECRET_KEY`
- `MONGODB_URL`
- `DATABASE_NAME`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (seeded on startup via `AuthService.sync_admin_user`)

### Run

```bash
uv run uvicorn main:app --reload
```

- OpenAPI: `http://127.0.0.1:8000/docs`
- Admin: `http://127.0.0.1:8000/admin`

### Docker services

```bash
docker compose up -d
```

Note: `docker-compose.yml` maps Redis host port **6380** → container `6379`. Align `REDIS_URL` if you enable cache/tasks locally.

### Code quality

Pre-commit (Ruff + mypy hooks) is configured in `.pre-commit-config.yaml`.

## 10. Folder structure (actual)

```text
.
├── config/              # Settings (Pydantic)
├── core/                # Bootstrap, DB, admin registry, signals, exceptions, enums
├── domain/              # Beanie models + document bases
├── repositories/        # BaseRepository
├── services/            # Auth, mail, Redis helpers
├── schemas/             # Pydantic schemas
├── utils/               # Security utilities
├── web/
│   ├── generic/         # CBV + mixins
│   ├── permissions/     # Permission classes
│   └── routers/         # FastAPI routers (auth, admin, pages)
├── templates/           # Optional overrides (email examples); defaults in backbone/templates/
├── main.py              # Application entry (+ demo model)
├── docker-compose.yml
├── pyproject.toml       # Project metadata + runtime deps (authoritative for uv)
├── requirements.txt     # Subset / alternate install list (may drift from pyproject)
├── BACKBONE_ARCHITECTURE.md  # Conceptual doc (paths partially legacy)
└── README.md            # This file
```

## 11. Future extensibility (recommended direction)

Short, prioritized roadmap aligned with production hardening:

1. **Split “framework” from “application”**: move demo `TestProject` to `examples/` or `app/` package; keep `main.py` thin.
2. **Strict layering**: introduce explicit **application services** + **DTOs** so routers do not construct Beanie documents directly.
3. **Pydantic v2 everywhere**: response models per resource; retire untyped `Dict[str, Any]` bodies in generic views where feasible.
4. **Permissions ↔ domain alignment**: permission classes should match the real `User` model (`role`-based admin) or add explicit `is_staff` fields—pick one model and enforce consistently.
5. **Testing**: add `tests/` with async pytest, in-memory Mongo (or testcontainers), and router-level tests for auth + one generic CRUD model.
6. **Dependency hygiene**: trim unused ML/search-related packages from `pyproject.toml` unless features land; keep optional extras for AI integrations.
7. **Admin modularization**: split `web/routers/admin.py` into smaller modules (auth, CRUD handlers, attachment IO, template setup).
8. **Operational concerns**: structured logging, request IDs, health/readiness routes, and migration story for Beanie schema changes.

---

Additional architecture notes live in `BACKBONE_ARCHITECTURE.md` (conceptual; verify paths against this repo when reading).
