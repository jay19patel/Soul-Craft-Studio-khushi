#!/bin/sh
set -e

TLS_HOST="${TLS_HOST:-35.226.230.226}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-developer.jay19@gmail.com}"

if [ -z "$TLS_HOST" ] || [ -z "$CERTBOT_EMAIL" ]; then
  echo "TLS_HOST and CERTBOT_EMAIL are required."
  exit 1
fi

docker compose up -d nginx

docker compose --profile ssl run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  -d "$TLS_HOST"

sed "s/__TLS_HOST__/$TLS_HOST/g" \
  docker/nginx/templates/default.ssl.conf.template \
  > docker/nginx/conf.d/default.conf

docker compose exec nginx nginx -t
docker compose restart nginx

echo "HTTPS is configured for https://$TLS_HOST"
