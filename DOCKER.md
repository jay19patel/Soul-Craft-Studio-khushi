# Docker Commands

Docker Compose does not have custom `--dev` / `--prod` flags, so this project uses separate compose files and short Make commands.

## Development

```bash
make dev
```

This starts:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api`
- Redis
- Celery worker

Development is intentionally simple for web serving: no Nginx, no LetsEncrypt, and no Postgres. It still runs Redis and Celery so background jobs can be tested locally. Django uses SQLite from `backend/db.sqlite3`, and source code is mounted into the containers for hot reload.

## Production

```bash
make prod
```

This starts:

- Frontend: `http://localhost:3000`
- Backend through Nginx: `http://localhost`
- PostgreSQL
- Redis
- Celery worker

Production builds optimized images, uses PostgreSQL, and keeps static/media files in Docker volumes for Nginx to serve. The `make prod` command loads production variables from `backend/.env` for Compose interpolation.

For a real domain, set this in `backend/.env` before building production:

```env
PROD_NEXT_PUBLIC_API_URL=https://your-domain.com/api
FRONTEND_URL=https://your-domain.com
ALLOWED_HOSTS=your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com
```

## Manual Commands

If you do not want to use `make`, run Compose directly:

```bash
docker compose -f docker-compose.dev.yml up --build
docker compose --env-file ./backend/.env -f docker-compose.prod.yml up --build -d
```

Stop containers:

```bash
make dev-down
make prod-down
```
