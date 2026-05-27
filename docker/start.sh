#!/usr/bin/env bash
set -euo pipefail

cd /app/backend
python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [[ -n "${DJANGO_SUPERUSER_USERNAME:-}" && -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]]; then
  python manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model

User = get_user_model()
username = os.environ["DJANGO_SUPERUSER_USERNAME"]
password = os.environ["DJANGO_SUPERUSER_PASSWORD"]
email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")

user, created = User.objects.get_or_create(
    username=username,
    defaults={
        "email": email,
        "is_staff": True,
        "is_superuser": True,
    },
)
user.email = email or user.email
user.is_staff = True
user.is_superuser = True
user.set_password(password)
user.save()

action = "created" if created else "updated"
print(f"Superuser {username!r} {action}.")
PY
else
  echo "Skipping superuser setup. Set DJANGO_SUPERUSER_USERNAME and DJANGO_SUPERUSER_PASSWORD to enable it."
fi

gunicorn ecommerce.wsgi:application \
  --bind "0.0.0.0:${BACKEND_PORT:-8000}" \
  --workers "${GUNICORN_WORKERS:-2}" &
backend_pid=$!

cd /app/frontend
HOSTNAME=0.0.0.0 npm run start -- --port "${PORT:-3000}" &
frontend_pid=$!

term() {
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}
trap term TERM INT

wait -n "$backend_pid" "$frontend_pid"
term
