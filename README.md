# HealthHack Event Platform

Production-oriented monorepo for the reusable HealthHack Event Operating System.

## Stack

- Next.js + TypeScript web app in `apps/web`
- NestJS API in `apps/api`
- BullMQ worker in `apps/worker`
- PostgreSQL + Prisma in `packages/database`
- Redis, MinIO, and Mailpit for local infrastructure

## Local Start

1. Copy `.env.example` to `.env` and replace secrets.
2. Start infrastructure with `docker compose up -d`.
3. Install dependencies with `pnpm install`.
4. Generate Prisma client with `pnpm db:generate`.
5. Run migrations with `pnpm db:migrate:dev`.
6. Start apps with `pnpm dev`.

Seed data is available with `pnpm db:seed:dev` and is blocked in production.

## Documentation

The implementation status and requirement traceability matrix live in `docs/`.
