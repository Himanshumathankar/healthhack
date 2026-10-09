# Architecture

HealthHack is a modular monolith with separate deployable process types:

- `apps/web`: Next.js public, participant, admin, reviewer, judge, and coordinator interfaces.
- `apps/api`: NestJS versioned REST API with server-side authorization and OpenAPI.
- `apps/worker`: BullMQ workers for email, fanout, imports, exports, integrations, and long-running operations.
- `packages/database`: Prisma schema, migrations, and client.
- `packages/contracts`: shared validation and API contracts.
- `packages/auth`: permission vocabulary and shared authorization helpers.
- `packages/config`: startup environment validation.
- `packages/logger`: structured logging.

The backend is organized around event-scoped domain modules so high-volume areas can be extracted later without changing product contracts.
