## Backend Docker Setup

Run the backend stack from this folder:

```bash
cd backend
docker compose up --build
```

This starts only the backend services:

- Nginx public backend entrypoint on `http://localhost`
- Django API privately inside Docker on `web:8000`
- PostgreSQL privately inside Docker on `postgres:5432`
- Redis privately inside Docker on `redis:6379`
- Celery worker for queued email/background jobs

Local non-Docker development still uses SQLite when `ENVIRONMENT=development`.
Docker Compose sets `ENVIRONMENT=production` and uses PostgreSQL through `DATABASE_URL`.
When `SEED_INITIAL_DATA=True`, startup seeds starter catalog data after migrations.
The seed command is idempotent, so it updates the same starter records instead of duplicating them.

For Vercel production, update `.env`:

```env
ALLOWED_HOSTS=your-api-domain.com
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
```
