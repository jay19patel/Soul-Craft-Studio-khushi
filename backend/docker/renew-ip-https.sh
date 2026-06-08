#!/bin/sh
set -e

# Detect where the script is executed from and set paths/commands accordingly
if [ -d "backend" ]; then
  COMPOSE_CMD="docker compose --env-file ./backend/.env -f ./backend/docker-compose.yml"
else
  COMPOSE_CMD="docker compose --env-file .env -f docker-compose.yml"
fi

echo "Renewing certificates..."
$COMPOSE_CMD --profile ssl run --rm certbot renew --webroot --webroot-path /var/www/certbot
$COMPOSE_CMD exec nginx nginx -t
$COMPOSE_CMD exec nginx nginx -s reload
echo "Certificates renewed and Nginx reloaded successfully!"
