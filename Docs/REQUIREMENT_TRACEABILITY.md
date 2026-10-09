# Requirement Traceability Matrix

| Spec Section | Requirement Area | Owning Modules | Tests |
| --- | --- | --- | --- |
| 0, 82, 86, 87 | Execution contract, definition of done, shortcut bans, working method | All modules, `docs/IMPLEMENTATION_STATUS.md` | Repository scans, feature checklists |
| 1, 5, 58 | Multi-event event operating system | `packages/database`, `apps/api` event module | Event config unit/integration tests |
| 2, 60, 61, 62 | Scale, burst handling, connection management, load tests | API, worker, infra, `tests/load` | k6/Artillery scenarios |
| 3, 4, 79 | Architecture, stack, environment config | Monorepo, `@healthhack/config`, Docker Compose | Typecheck, config validation tests |
| 6 | Authentication | API identity module, database auth models, web auth UI | Unit, integration, E2E auth flows |
| 7, 38 | RBAC and audit logging | `@healthhack/auth`, API policy/audit modules, database RBAC/audit models | Permission and audit integration tests |
| 8, 50 | Public website, CMS, design system | `apps/web`, CMS module, `packages/ui` | UI, accessibility, API tests |
| 9 | Participant profile and configurable fields | Profile module, event settings | Unit/integration/E2E profile tests |
| 10, 11 | Team system and team finder | Team module, notification/email jobs | Concurrency, invitation, finder E2E tests |
| 12, 13, 39, 40 | Community, announcements, notifications, email templates/jobs | Community, announcements, email, worker | Queue, moderation, delivery tests |
| 14, 15, 19, 57 | Rounds, submissions, transitions, status models | Competition modules, storage, worker | Deadline, transition, upload tests |
| 16 | Payments | Payment provider abstraction, Razorpay adapter, worker | Webhook signature/idempotency tests |
| 17, 18 | Review and judge systems | Evaluation modules | Authorization, scoring, locking tests |
| 20, 21 | Interview scheduling and rescheduling | Interview module, calendar adapter, worker | Slot conflict, Calendar contract tests |
| 22, 23, 24 | Approval workflows, dynamic forms, reminders | Approval/forms/reminder modules | Conditional logic, audience, reminder tests |
| 25, 26, 72 | Import/export framework and examples | Data operations modules, worker, storage | Parser, preview, rollback, export tests |
| 27-35 | Finale, RSVP, accommodation, food, transport, travel, venue, QR, coordinator | Operations modules, scanner PWA | Concurrency, mobile E2E, offline-mode tests |
| 36, 37, 71 | Analytics, search, data privacy | Analytics/search modules | Query correctness, privacy tests |
| 41, 45, 68, 69, 70 | Caching, consistency, integration failure, idempotency, deadlines | Shared infra patterns across modules | Race-condition and failure-mode tests |
| 46, 47, 48, 49 | Security, privacy, accessibility, responsive behavior | All backend/frontend modules | Security, a11y, responsive E2E tests |
| 63, 64, 65 | Automated testing, CI/CD, migration discipline | CI, test suites, database package | CI pipeline |
| 66, 67, 80 | Backup, monitoring, IaC | Infra, observability | Restore drill docs, alert checks |
| 73, 74, 75 | Certificates, results, support desk | Post-event modules | Generation, publish, ticketing tests |
| 77, 78, 81, 83, 84, 85, 88-90 | Seed data, docs, phases, readiness, UX, configurability, acceptance, deliverables | Docs, all modules | DoD review, acceptance scenario E2E |
