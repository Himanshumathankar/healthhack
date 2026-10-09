#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  printf '\n==> %s\n' "$1"
}

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install it first, then run this script again." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop first, then run this script again." >&2
  exit 1
fi

if [ ! -f .env ]; then
  log "Creating .env from .env.example"
  cp .env.example .env
fi

log "Loading local environment"
set -a
source ./.env
set +a

if ! docker info >/dev/null 2>&1; then
  if [ "$(uname -s)" = "Darwin" ] && [ -d "/Applications/Docker.app" ]; then
    log "Starting Docker Desktop"
    open -a Docker
  fi

  log "Waiting for Docker"
  for _ in {1..60}; do
    if docker info >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not ready. Start Docker and run this script again." >&2
  exit 1
fi

log "Starting local infrastructure"
docker compose up -d --build

log "Installing dependencies"
pnpm install

log "Generating Prisma client"
pnpm db:generate

log "Applying database migrations"
pnpm db:migrate:dev

log "Starting apps"
exec pnpm dev
