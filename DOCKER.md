# Docker Run Guide

Build the full frontend + backend image:

```bash
docker build -t khusi-website:latest .
```

Run the full system:

```bash
docker network create khusi_network
docker volume create khusi_redis
docker run -d \
  --name khusi-redis \
  --network khusi_network \
  -v khusi_redis:/data \
  redis:7.4-alpine redis-server --appendonly yes

docker run --rm \
  --name khusi-website \
  --network khusi_network \
  -p 3000:3000 \
  -p 8000:8000 \
  -e ENVIRONMENT=development \
  -e FRONTEND_URL=http://localhost:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000/api \
  -e SQLITE_PATH=/app/data/db.sqlite3 \
  -e REDIS_URL=redis://khusi-redis:6379/1 \
  -e CACHE_TIMEOUT=300 \
  -e CACHE_KEY_PREFIX=khusi \
  -e DJANGO_SUPERUSER_USERNAME=admin \
  -e DJANGO_SUPERUSER_EMAIL=admin@example.com \
  -e DJANGO_SUPERUSER_PASSWORD=admin123456 \
  -v khusi_sqlite:/app/data \
  khusi-website:latest
```

Open:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- Django admin: http://localhost:8000/admin

The container runs migrations automatically on startup. For compose:

```bash
docker compose up --build
```

Compose starts Redis, Django + Next.js, and a Celery worker for queued email delivery.

Default compose admin login:

- Username: `admin`
- Password: `admin123456`

Override it with environment variables:

```bash
DJANGO_SUPERUSER_USERNAME=myadmin \
DJANGO_SUPERUSER_EMAIL=myadmin@example.com \
DJANGO_SUPERUSER_PASSWORD='change-this-password' \
docker compose up --build
```

Do not bake `backend/.env` into the image. Pass production secrets with `-e` flags or an env file at runtime.

## Outgoing Email

The default Django console email backend prints messages in Docker logs; it does not deliver them to an inbox. Email attempts are saved in the `EmailLog` database table and managed through Django admin:

- Django admin: http://localhost:8000/admin

For actual Gmail SMTP delivery, create a root `.env` file used by Docker Compose:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=youraddress@gmail.com
EMAIL_HOST_PASSWORD=your-google-app-password
DEFAULT_FROM_EMAIL=Khusi Website <youraddress@gmail.com>
```

Use a Google App Password rather than the Gmail account password. Restart services after changing email settings:

```bash
docker compose up --build
```

`SENT` means the configured backend accepted the message for sending. With `console.EmailBackend`, it only confirms log output; with `smtp.EmailBackend`, it confirms the SMTP server accepted it.
