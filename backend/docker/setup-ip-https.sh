#!/bin/sh
set -e

# Detect where the script is executed from and set paths/commands accordingly
if [ -d "backend" ]; then
  # Root directory of the project
  PROJECT_ROOT="."
  BACKEND_DIR="./backend"
  COMPOSE_CMD="docker compose --env-file ./backend/.env -f ./backend/docker-compose.yml"
else
  # Inside backend directory
  PROJECT_ROOT=".."
  BACKEND_DIR="."
  COMPOSE_CMD="docker compose --env-file .env -f docker-compose.yml"
fi

# Load environment variables if they are not already set in the env
if [ -f "$BACKEND_DIR/.env" ]; then
  # Read TLS_HOST and CERTBOT_EMAIL line by line to support various shell environments
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      TLS_HOST=*)
        val=$(echo "$line" | cut -d'=' -f2-)
        val=$(echo "$val" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        [ -z "$TLS_HOST" ] && TLS_HOST="$val"
        ;;
      CERTBOT_EMAIL=*)
        val=$(echo "$line" | cut -d'=' -f2-)
        val=$(echo "$val" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        [ -z "$CERTBOT_EMAIL" ] && CERTBOT_EMAIL="$val"
        ;;
    esac
  done < "$BACKEND_DIR/.env"
fi

TLS_HOST="${TLS_HOST:-35.226.230.226}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-developer.jay19@gmail.com}"

if [ -z "$TLS_HOST" ] || [ -z "$CERTBOT_EMAIL" ]; then
  echo "Error: TLS_HOST and CERTBOT_EMAIL are required in environment or .env file."
  exit 1
fi

echo "Setting up HTTPS for host: $TLS_HOST"

# Determine if TLS_HOST is an IP address
IS_IP=0
if echo "$TLS_HOST" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
  IS_IP=1
fi

# 1. Create nginx config dir if it doesn't exist
mkdir -p "$BACKEND_DIR/docker/nginx/conf.d"

# Stop Nginx if it's already running/restarting to avoid lock issues
echo "Stopping Nginx before certificate generation..."
$COMPOSE_CMD stop nginx || true

if [ "$IS_IP" -eq 1 ]; then
  echo "Host '$TLS_HOST' is an IP address. Generating a self-signed certificate (Let's Encrypt does not support bare IPs)..."
  
  # Run a temporary certbot container with sh to create dir and generate self-signed cert
  $COMPOSE_CMD --profile ssl run --rm --entrypoint sh certbot -c "
    mkdir -p /etc/letsencrypt/live/$TLS_HOST && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/letsencrypt/live/$TLS_HOST/privkey.pem \
      -out /etc/letsencrypt/live/$TLS_HOST/fullchain.pem \
      -subj '/CN=$TLS_HOST'
  "
else
  echo "Host '$TLS_HOST' is a domain name. Generating a Let's Encrypt SSL certificate..."
  
  # Ensure Nginx is running in HTTP mode for the ACME challenge webroot verification
  echo "Starting Nginx in HTTP mode..."
  # Temporarily use default HTTP config if config is broken
  $COMPOSE_CMD up -d nginx
  
  # Run Certbot to get the certificate
  $COMPOSE_CMD --profile ssl run --rm certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$CERTBOT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    -d "$TLS_HOST"
fi

# 2. Generate the SSL Nginx configuration from template
echo "Generating SSL configuration for Nginx..."
sed "s/__TLS_HOST__/$TLS_HOST/g" \
  "$BACKEND_DIR/docker/nginx/templates/default.ssl.conf.template" \
  > "$BACKEND_DIR/docker/nginx/conf.d/default.conf"

# 3. Start services and apply configuration
echo "Starting Nginx and backend services to apply SSL configuration..."
$COMPOSE_CMD up -d

# Verify configuration offline using a temporary container to be safe
$COMPOSE_CMD run --rm --entrypoint nginx nginx -t || true

echo "=========================================================="
if [ "$IS_IP" -eq 1 ]; then
  echo "SUCCESS: Self-signed HTTPS configured at https://$TLS_HOST"
  echo "Note: Your browser will show a security warning because it is self-signed."
else
  echo "SUCCESS: Let's Encrypt HTTPS configured at https://$TLS_HOST"
fi
echo "=========================================================="
