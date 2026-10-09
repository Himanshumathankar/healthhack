# HealthHack Implementation Status

Updated: 2026-08-26

## Implemented

- Phase 0 repository foundation:
  - pnpm workspace and Turborepo task graph.
  - Strict shared TypeScript configuration.
  - Shared ESLint configuration.
  - Docker Compose services for PostgreSQL, Redis, MinIO, and Mailpit.
  - Environment variable example with production integration placeholders.
  - GitHub Actions CI definition for install, Prisma validation, typecheck, lint, tests, and build.
- Core shared packages:
  - `@healthhack/contracts` with Zod request/public-user schemas.
  - `@healthhack/auth` with canonical permission keys.
  - `@healthhack/config` with fail-fast typed environment validation.
  - `@healthhack/logger` with structured Pino logging and redaction.
  - `@healthhack/email` with SMTP provider abstraction and local Mailpit-compatible adapter.
  - `@healthhack/database` with Prisma schema for identity, events, RBAC, teams, invitations, and audit logging.
- App shells:
  - NestJS API with health/readiness endpoints and OpenAPI route.
  - Identity registration endpoint using Argon2id and single-use verification token storage.
  - Registration queues a persisted verification email and background `email.send` job.
  - Email verification endpoint with expiring single-use token validation.
  - Login endpoint with Argon2id password verification and revocable session token storage.
  - Authenticated current-user endpoint backed by server-side session lookup.
  - Team creation endpoint with event scoping, participant upsert, leader membership, and audit logging.
  - Team invitation creation and acceptance endpoints with expiring opaque tokens, capacity checks, and audit logging.
  - Team invitation creation queues a persisted invitation email and background `email.send` job.
  - Permission-protected event team listing endpoint for admin-style lookup.
  - BullMQ worker process connected to Redis with SMTP email delivery, retries, and persisted sent/failed states.
  - Next.js web shell with public home and registration route.
- Database:
  - Reviewed initial SQL migration generated at `packages/database/prisma/migrations/20260826090000_initial_core/migration.sql`.
  - Migration includes `citext` extension setup for case-insensitive email fields.
  - Initial migration applied successfully to local Docker PostgreSQL.
  - Email message migration applied successfully to local Docker PostgreSQL.
  - Development seed created the `healthhack-2027` event.

## Tests

- Test tooling is declared with Vitest across packages/apps.
- Initial unit tests exist for contracts, permissions, token helpers, and team code generation.
- Live smoke test confirmed registration creates an email record, worker sends through Mailpit, and database status becomes `SENT`.
- Current verification commands passing:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm build`
  - Prisma schema validation with explicit database URL environment variables.

## Known Issues

- Dependencies have been installed locally and `pnpm-lock.yaml` has been generated.
- Docker services are running locally for PostgreSQL, Redis, MinIO, and Mailpit.
- Email verification and team invitations store real token hashes and return tokens only outside production for local development visibility.
- Registration UI uses an HTML form post to the API and does not yet implement client-side success/error states.
- Profile completion, join-by-team-code requests, admin audit views, and email queue integration remain incomplete.

## Next Required Work

1. Add integration tests for identity, session guard, audit service, team service, and email queue processing against PostgreSQL/Redis.
2. Add password reset, session revocation, and distributed rate limits.
3. Complete profile editing, join-by-team-code requests, admin audit views, and stronger RBAC management flows.
