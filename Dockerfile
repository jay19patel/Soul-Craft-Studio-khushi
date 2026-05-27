# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM frontend-deps AS frontend-build
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim AS backend-deps
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /app/backend
RUN pip install --no-cache-dir uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.13-slim AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=development \
    FRONTEND_URL=http://localhost:3000 \
    NEXT_PUBLIC_API_URL=http://localhost:8000/api \
    PORT=3000 \
    BACKEND_PORT=8000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node:24-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:24-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

COPY --from=backend-deps /opt/venv /opt/venv
COPY backend/ /app/backend/
COPY --from=frontend-build /app/frontend /app/frontend

COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000 8000

CMD ["/app/start.sh"]
