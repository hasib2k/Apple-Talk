#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ─── Colours ────────────────────────────────────────────────
GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()  { echo -e "${GREEN}[start]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

# ─── .env setup ─────────────────────────────────────────────
if [ ! -f "$ROOT/.env" ]; then
  warn ".env not found — copying from .env.example"
  cp "$ROOT/.env.example" "$ROOT/.env"
  warn "Edit .env with your secrets before going to production."
fi

cp "$ROOT/.env" "$ROOT/apps/api/.env"
cp "$ROOT/.env" "$ROOT/apps/web/.env"

# ─── Check MySQL is running ──────────────────────────────────
info "Checking MySQL..."
if ! nc -z 127.0.0.1 3306 2>/dev/null && ! powershell.exe -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 3306 -InformationLevel Quiet" 2>/dev/null | grep -qi "true"; then
  error "MySQL is not running. Please start it from XAMPP and re-run this script."
fi
info "MySQL is ready."

# ─── Check Redis/Memurai is running ─────────────────────────
info "Checking Redis (Memurai)..."
MEMURAI_CLI="/c/Program Files/Memurai/memurai-cli.exe"
if ! "$MEMURAI_CLI" ping 2>/dev/null | grep -q PONG; then
  error "Memurai is not running. Start it from Services or run: sc start Memurai"
fi
info "Redis (Memurai) is ready."

# ─── Prisma generate + migrate ──────────────────────────────
info "Generating Prisma client..."
cd "$ROOT/apps/api"
pnpm prisma generate
info "Running Prisma migrations..."
pnpm prisma migrate deploy
cd "$ROOT"

# ─── Kill any process on port 3000 or 5173 ──────────────────
info "Freeing ports 3000 and 5173..."
taskkill //F //IM node.exe 2>/dev/null || true

# ─── Start localtunnel for API (port 3000) ──────────────────
info "Starting localtunnel for API (port 3000)..."
npx localtunnel --port 3000 > /tmp/lt_out.txt 2>&1 &
LT_PID=$!
sleep 4
LT_URL=$(grep -o 'https://[^ ]*' /tmp/lt_out.txt | head -1)
if [ -z "$LT_URL" ]; then
  warn "localtunnel URL not found — using local IP for API"
else
  info "API tunnel: $LT_URL"
  sed -i "s|VITE_API_URL=.*|VITE_API_URL=$LT_URL|" "$ROOT/.env"
  sed -i "s|VITE_SOCKET_URL=.*|VITE_SOCKET_URL=$LT_URL|" "$ROOT/.env"
  cp "$ROOT/.env" "$ROOT/apps/api/.env"
  cp "$ROOT/.env" "$ROOT/apps/web/.env"
fi

# ─── Start ngrok for frontend (port 5173) ───────────────────
info "Starting ngrok for frontend (port 5173)..."
ngrok http 5173 > /dev/null 2>&1 &
sleep 3
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | sed 's/"public_url":"//')
if [ -n "$NGROK_URL" ]; then
  info "Frontend tunnel: $NGROK_URL"
fi

# ─── Start all apps via Turbo ───────────────────────────────
info "Starting API (port 3000) and Web (port 5173)..."
pnpm dev
