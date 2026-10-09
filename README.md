# HealthHack Event Platform

Production-oriented monorepo for the reusable HealthHack Event Operating System.

## Stack

- Next.js + TypeScript web app in `apps/web`
- NestJS API in `apps/api`
- BullMQ worker in `apps/worker`
- PostgreSQL + Prisma in `packages/database`
- Redis, MinIO, and Mailpit for local infrastructure

## Local Start

Run the full local setup and dev stack:

```sh
pnpm dev:setup
```

This creates `.env` from `.env.example` when needed, starts Docker services, installs dependencies, generates Prisma, applies local migrations, and starts the apps.

MinIO is built locally from a pinned source release because the former container image is unavailable. The first startup downloads the build dependencies and takes longer; subsequent runs reuse the local image.

Manual startup:

1. Copy `.env.example` to `.env` and replace secrets.
2. Start infrastructure with `docker compose up -d`.
3. Install dependencies with `pnpm install`.
4. Generate Prisma client with `pnpm db:generate`.
5. Run migrations with `pnpm db:migrate:dev`.
6. Start apps with `pnpm dev`.

Seed data is available with `pnpm db:seed:dev` and is blocked in production.

## Documentation

The implementation status and requirement traceability matrix live in `docs/`.
