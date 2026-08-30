#!/usr/bin/env bash
# One-command setup for Openwrite.
#
#   bash scripts/setup.sh
#
# Does what the README quickstart says:
#   1. checks prerequisites (node 20+, docker)
#   2. creates .env from .env.example if missing
#   3. installs npm dependencies (skips if already installed)
#   4. brings up Postgres + Redis + schema/seed init via docker compose
#   5. starts the Next.js dev server on http://localhost:13000
#
# Demo login after startup: demo@local / demo1234
set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

bold "Openwrite setup"

# 1. Prerequisites -----------------------------------------------------------
command -v node >/dev/null 2>&1 || die "Node.js not found. Install Node 20+ first: https://nodejs.org"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node $(node -v) found; Node 20+ is required."
ok "Node $(node -v)"

command -v docker >/dev/null 2>&1 || die "Docker not found. Install Docker Desktop (macOS/Windows) or the Docker engine (Linux) first."
docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start Docker and re-run this script."
ok "Docker is running"

# 2. .env --------------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  ok "Created .env from .env.example (defaults work for local dev)"
else
  ok ".env already exists"
fi

# 3. Dependencies ------------------------------------------------------------
if [ -d node_modules ]; then
  ok "Dependencies already installed (node_modules present)"
else
  bold "Installing npm dependencies…"
  npm install
  ok "Dependencies installed"
fi

# 4. Postgres + Redis + schema/seed -----------------------------------------
bold "Bringing up Postgres + Redis (docker compose)…"
docker compose up -d postgres redis
ok "Waiting for Postgres to accept connections…"
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-trueforge}" >/dev/null 2>&1; do
  sleep 1
done
ok "Postgres is up"
docker compose up recap-db-init >/dev/null 2>&1 || docker compose up recap-db-init
ok "Schema + seed applied (recap-db-init sidecar)"

# 5. Dev server --------------------------------------------------------------
bold "Starting the dev server on http://localhost:13000 …"
echo
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │  Openwrite is starting:  http://localhost:13000     │"
echo "  │  Demo login:             demo@local / demo1234      │"
echo "  │  Stop:                   Ctrl+C (containers stay up;│"
echo "  │                          'docker compose down'      │"
echo "  │                          to stop them too)          │"
echo "  └─────────────────────────────────────────────────────┘"
echo

npm run dev
