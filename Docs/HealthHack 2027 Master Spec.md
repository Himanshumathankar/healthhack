# HealthHack 2027 — Production Engineering Master Specification

> **Status:** Authoritative product + engineering specification  
> **Target:** HealthHack 2027 hackathon operating platform  
> **Scale:** 10,000+ registered users, high peak concurrency around deadlines/results/interviews  
> **Primary objective:** Build a complete, production-ready hackathon operating system — not a demo, not a mock dashboard, and not a static event website.

---

# 0. CODEX EXECUTION CONTRACT — READ THIS FIRST

This file is the single source of truth for implementation.

Codex must build the entire project described here end-to-end. The product must be functional in development, staging, and production environments.

## Non-negotiable implementation rules

1. **NO MOCK FEATURES.**
   - Do not create buttons that do nothing.
   - Do not create pages that only display placeholder text.
   - Do not use fake hard-coded API responses except inside explicit test fixtures.
   - Do not use local arrays as substitutes for real persistence.
   - Do not display fake analytics, fake registrations, fake scores, fake payment states, fake teams, or fake schedules in production code.
   - Demo/seed data may exist only behind a clearly documented development seed command.

2. **NO INCOMPLETE FEATURES.**
   Every feature exposed in the UI must include:
   - database model/migration,
   - backend/domain logic,
   - authorization,
   - validation,
   - API endpoint or server action,
   - user interface,
   - loading state,
   - empty state,
   - error state,
   - success state,
   - audit logging where applicable,
   - automated tests,
   - documentation.

3. **NO DEAD ROUTES.**
   Every navigation item must lead to a finished route. If a feature is not implemented yet during an intermediate development phase, do not expose it in production navigation until it is complete.

4. **NO SILENT FAILURES.**
   All errors must be logged with trace/correlation identifiers. Users must receive safe, actionable error messages.

5. **NO AUTHORIZATION ONLY IN THE FRONTEND.**
   Hiding a button is not access control. Every restricted operation must be enforced server-side.

6. **NO TRUSTING CLIENT-SUPPLIED IDs OR ROLES.**
   Permissions, event membership, team membership, ownership, round eligibility, and resource access must be resolved server-side.

7. **NO HARD-CODING HEALTHHACK 2027 BUSINESS RULES.**
   Team sizes, rounds, deadlines, scoring criteria, fees, forms, reschedule rules, RSVP windows, food plans, accommodation logic, transport options, panel schedules, and other event rules must be configurable by administrators.

8. **NO DESTRUCTIVE IMPORTS WITHOUT PREVIEW.**
   Excel/CSV imports must support validation, mapping, preview, row-level errors, idempotency, audit logs, and safe commit.

9. **NO DIRECT FILE TRUST.**
   All uploads must enforce file type, MIME validation, extension validation, size limits, authorization, malware scanning strategy, secure object keys, and signed access URLs.

10. **NO PASSWORDS OR SECRETS IN SOURCE CONTROL.**
    Use environment variables/secrets manager. Commit `.env.example`, never real `.env`.

11. **NO PRODUCTION DATABASE `db push`-style shortcuts.**
    Use reviewed, versioned migrations.

12. **NO AUTOMATIC DELETION OF HISTORICAL SUBMISSIONS.**
    Submission revisions, scoring events, approval history, payment history, imports, and critical workflow changes must retain an audit trail.

13. **NO SINGLE-INSTANCE ASSUMPTIONS.**
    APIs, WebSocket/realtime delivery, workers, scheduled jobs, locks, rate limits, and sessions must work correctly when multiple application instances are running.

14. **NO UNBOUNDED QUERIES.**
    All admin listing endpoints require pagination, filtering, indexed sorting, and database-backed search appropriate to scale.

15. **NO N+1 QUERY PATTERNS IN HIGH-TRAFFIC VIEWS.**
    Profile, team dashboard, admin dashboard, reviewer queues, scheduling, and exports must be query-reviewed.

16. **NO “TODO IMPLEMENT LATER” IN USER-FACING FUNCTIONALITY.**
    TODO comments may exist only for explicitly optional future improvements and must not represent unfinished requirements in this specification.

17. **NO FAKE INTEGRATIONS.**
    Google Calendar/Meet, email, payment, object storage, queueing, etc. must use real integration adapters. Development may use local adapters such as Mailpit and MinIO, but their interfaces must match production adapters.

18. **NO ASSUMPTION THAT 10,000 USERS MEANS ONLY 10,000 REQUESTS.**
    Design for burst traffic when registrations close, results publish, interviews open, and final schedules are released.

19. **PRESERVE ACCESSIBILITY.**
    Public and authenticated interfaces should target WCAG 2.2 AA where practical.

20. **TYPE SAFETY MUST EXTEND ACROSS BOUNDARIES.**
    Use TypeScript strict mode, shared contracts or generated API clients, schema validation, typed configuration, and explicit error types.

---

# 1. Product Vision

HealthHack 2027 is not merely a public event website. It is a reusable **Hackathon Event Operating System** capable of managing the complete participant and organizer lifecycle.

The platform must support:

```text
Discover event
    ↓
Create account
    ↓
Create / join / discover a team
    ↓
Complete registration
    ↓
Payment where applicable
    ↓
Choose track/problem statement
    ↓
Submit required artifacts
    ↓
Review and scoring
    ↓
Configurable rounds
    ↓
Bulk shortlisting / waitlisting / rejection
    ↓
Interview scheduling
    ↓
Calendar / meeting integration
    ↓
Finalist selection
    ↓
Dynamic operational forms
    ↓
RSVP
    ↓
Accommodation / food / transport / travel operations
    ↓
Offline venue, panel and slot allocation
    ↓
QR entry / exit
    ↓
Food coupon redemption
    ↓
Final judging
    ↓
Results
    ↓
Certificates / post-event workflows
```

The same software should be reusable for HealthHack 2028 and later by creating a new event and configuring it from the admin interface.

---

# 2. Scale and Reliability Targets

## 2.1 Capacity assumptions

Design for at least:

- 10,000+ registered participant accounts.
- 2,000–5,000+ teams depending on team-size rules.
- 100+ admins, reviewers, judges, coordinators, volunteers combined.
- Tens of thousands of uploaded files and revisions.
- Large mail batches.
- Large Excel imports/exports.
- Hundreds of simultaneous interview slots.
- Thousands of dashboard refreshes immediately after announcements/results.
- High burst traffic within minutes of submission deadlines.
- High QR scanning activity at venue entry and meal windows.

## 2.2 Performance targets

Initial production objectives:

- Public cached pages: p95 < 500 ms from CDN for cacheable routes.
- Common authenticated API reads: p95 < 400 ms under normal production load.
- Common writes: p95 < 800 ms excluding external provider latency.
- Heavy exports/imports: asynchronous jobs, never synchronous blocking HTTP operations.
- Email batches: queue based.
- Result publication: pre-compute where appropriate and publish atomically.
- Dashboard queries: indexed and bounded.
- Uploads: direct-to-object-storage whenever possible instead of proxying large files through API instances.
- Target API error rate under normal conditions: < 0.5%.
- Graceful degradation for non-critical integrations.

## 2.3 Availability

Target architecture should allow:

- stateless API horizontal scaling,
- independent worker scaling,
- database backups and point-in-time recovery,
- Multi-AZ managed database in production,
- Redis HA in production,
- object storage durability,
- health/readiness endpoints,
- rolling deployments,
- rollback capability.

---

# 3. Architecture Strategy

## 3.1 Do NOT start with microservices

Build a **modular monolith** with explicit domain module boundaries, plus separate process types:

1. Web frontend.
2. API/backend.
3. Background workers.
4. Scheduler/cron worker.
5. Optional realtime gateway if needed separately later.

The backend must be organized so high-volume modules can be extracted into standalone services in the future without rewriting business logic.

At 10,000+ users, database design, caching, background queues, connection pooling, correct indexes, object storage, rate limiting, and horizontal scaling matter much more than prematurely introducing dozens of networked services.

## 3.2 Monorepo

Recommended structure:

```text
healthhack/
├── apps/
│   ├── web/                  # Next.js public + participant/admin web app
│   ├── api/                  # NestJS API
│   ├── worker/               # Queue workers
│   └── scheduler/            # Scheduled/recurring jobs if separated
│
├── packages/
│   ├── ui/                   # shared design system
│   ├── contracts/            # schemas / API contracts / events
│   ├── database/             # Prisma schema, migrations, client
│   ├── config/               # typed config
│   ├── auth/                 # shared auth contracts/helpers
│   ├── logger/               # structured logging
│   ├── email/                # templates + provider abstraction
│   ├── storage/              # S3/R2 abstraction
│   ├── observability/        # tracing/metrics helpers
│   ├── testing/              # shared fixtures/builders
│   └── eslint-config/
│
├── infra/
│   ├── docker/
│   ├── terraform/
│   ├── local/
│   └── monitoring/
│
├── docs/
├── scripts/
├── .github/workflows/
├── docker-compose.yml
├── package.json
└── README.md
```

Use `pnpm` workspaces and Turborepo or Nx. Keep build caching and CI deterministic.

---

# 4. Recommended Technology Stack

## 4.1 Frontend

- Next.js with App Router.
- React.
- TypeScript strict mode.
- Tailwind CSS.
- shadcn/ui / Radix primitives.
- React Hook Form.
- Zod validation.
- TanStack Query for client/server state synchronization where appropriate.
- TanStack Table for data-heavy admin interfaces.
- Recharts or Apache ECharts for analytics.
- Lucide icons.
- Accessible date/time pickers.
- PWA support for coordinator scanning interfaces.
- QR camera scanning library with fallback manual token entry.

## 4.2 Backend

- NestJS.
- TypeScript strict mode.
- REST API with OpenAPI documentation.
- Domain modules with services, policies, repositories and event handlers.
- Prisma ORM.
- PostgreSQL 18.x stable production major unless deployment provider requires another supported major.
- PgBouncer/RDS Proxy or equivalent connection pooling for horizontal scale.
- Redis for:
  - caching,
  - distributed locks,
  - ephemeral realtime state,
  - rate-limit counters,
  - queue backend if BullMQ is chosen.
- BullMQ for asynchronous jobs in the initial architecture.
- Architect queue interfaces so SQS can replace or supplement BullMQ later if operational needs demand it.

## 4.3 Storage

Production:
- Amazon S3 or Cloudflare R2 via S3-compatible adapter.
- Separate buckets/prefixes for public assets, protected submissions, imports, exports, and generated documents.
- Signed GET/PUT URLs.
- Object metadata stored in PostgreSQL.
- CDN only for content that is legitimately public.

Development:
- MinIO supported through the same storage abstraction.

## 4.4 Email

Production adapters:
- Amazon SES or Resend.

Development:
- Mailpit/MailHog.

Email sending must always be queued. Do not perform large outbound sends inside request lifecycle.

## 4.5 Payments

India-focused default:
- Razorpay.

Build `PaymentProvider` abstraction so payment provider can be replaced.

Requirements:
- server-created orders,
- webhook signature verification,
- idempotency,
- reconciliation,
- refund tracking,
- receipt/invoice metadata,
- payment state machine.

## 4.6 Scheduling and meetings

- Google Calendar API.
- Google Meet conference creation through Calendar API capabilities.
- ICS fallback for participants.
- Provider abstraction for future Outlook/Teams support.

## 4.7 Observability

- OpenTelemetry tracing.
- Structured JSON logs using Pino.
- Sentry for frontend/backend error tracking or equivalent.
- Prometheus-compatible metrics.
- Grafana dashboards.
- Correlation/request IDs propagated through API → queue → worker.
- Health, readiness and liveness endpoints.

## 4.8 Deployment

Recommended production architecture on AWS:

```text
Internet
   ↓
Cloudflare DNS/CDN/WAF (optional but recommended)
   ↓
AWS Application Load Balancer
   ↓
┌──────────────────────────────┐
│ ECS/Fargate Web instances    │
│ ECS/Fargate API instances    │
│ ECS/Fargate Worker instances │
└──────────────────────────────┘
           ↓
   RDS PostgreSQL Multi-AZ
           +
   ElastiCache Redis
           +
        S3 / R2
           +
          SES
```

Alternative deployments can use Kubernetes, but Kubernetes is not required to support 10,000 users and should not be introduced only for prestige.

## 4.9 Local development

`docker compose up` must provide:

- PostgreSQL
- Redis
- MinIO
- Mailpit
- API
- worker
- web

Provide fast local onboarding.

---

# 5. Multi-Event Model

The system should not be tied to one event.

Core hierarchy:

```text
Platform
└── Event
    ├── Configuration
    ├── Branding
    ├── Registration
    ├── Tracks
    ├── Problem Statements
    ├── Teams
    ├── Rounds
    ├── Evaluations
    ├── Interviews
    ├── Forms
    ├── Operations
    ├── Venue
    └── Results
```

All event-owned data must include `event_id`.

A user account can participate in multiple events over multiple years.

Event-specific participant/team role must not be stored as a global user role.

---

# 6. Authentication

## 6.1 Universal login

There is one login system.

Do not create separate Team ID login.

Authentication:
- email + password,
- email verification,
- forgot/reset password,
- secure sessions,
- optional social OAuth later,
- optional passkeys later,
- admin MFA required or strongly enforced,
- optional participant MFA.

## 6.2 Password security

- Argon2id preferred.
- Strong server-side password policy.
- Password reset token single-use and short-lived.
- Email verification token single-use and expiring.
- Sessions revocable.
- List active sessions for users if feasible.

## 6.3 Rate limiting

Separate rate-limit profiles for:
- login,
- forgot password,
- email verification resend,
- registration,
- invite acceptance,
- community posting,
- search,
- file presigning,
- admin exports,
- scanning endpoints.

Use Redis-backed distributed rate limits.

## 6.4 Anti-abuse

- CAPTCHA/Turnstile on suspicious or publicly abusable entry points.
- Detect excessive signup attempts.
- Duplicate email prevention.
- Team membership uniqueness rules.
- Webhook signature verification.
- Bot protection at CDN/WAF layer.

---

# 7. Authorization and RBAC

Global platform roles:
- SUPER_ADMIN

Event roles:
- ADMIN
- REVIEWER
- JUDGE
- STUDENT_COORDINATOR
- PARTICIPANT

Team roles:
- TEAM_LEADER
- TEAM_MEMBER

Build permission-based RBAC rather than scattering role-name checks.

Example permissions:

```text
event.manage
event.settings.manage
users.read
users.manage
teams.read
teams.manage
teams.bulk_transition
rounds.manage
submissions.read
submissions.evaluate
judging.score
reviews.score
interviews.manage
interviews.reschedule.approve
forms.manage
forms.responses.read
operations.food.manage
operations.transport.manage
operations.accommodation.manage
venue.manage
passes.scan
coupons.scan
exports.create
imports.create
analytics.read
announcements.manage
community.moderate
audit.read
roles.manage
```

Support role-permission configuration while protecting critical super-admin capabilities.

All access decisions must also include resource ownership/event membership checks.

---

# 8. Public Website and CMS

## 8.1 Homepage

Homepage sections:

1. Hero.
2. Event description.
3. Key statistics.
4. Tracks.
5. Problem statements teaser.
6. Why participate.
7. Timeline.
8. Prizes.
9. Eligibility.
10. How it works.
11. Judging criteria.
12. Mentors.
13. Judges.
14. Sponsors.
15. Venue.
16. FAQ.
17. Community CTA.
18. Registration CTA.
19. Footer.

## 8.2 Dedicated routes

Provide:
- `/`
- `/about`
- `/tracks`
- `/problem-statements`
- `/problem-statements/[slug]`
- `/timeline`
- `/prizes`
- `/eligibility`
- `/rules`
- `/judging`
- `/mentors`
- `/judges`
- `/sponsors`
- `/venue`
- `/faq`
- `/contact`
- `/community`

## 8.3 CMS

Admin-editable content:
- page sections,
- rich text,
- CTA links,
- images,
- SEO title/description,
- OpenGraph metadata,
- tracks,
- problem statements,
- prizes,
- rules,
- FAQ,
- timeline,
- sponsors,
- mentors/judges,
- venue information,
- contact details.

CMS changes must have draft/published state and optional scheduling.

## 8.4 SEO

- semantic HTML,
- structured metadata,
- sitemap,
- robots,
- canonical URLs,
- OpenGraph,
- Twitter cards,
- event structured data where appropriate,
- optimized images,
- public page caching.

---

# 9. User Registration and Participant Profile

Participant account onboarding fields configurable by admin where possible.

Base profile:
- full name,
- email,
- phone,
- college/university,
- degree,
- branch,
- graduation year,
- city,
- state,
- LinkedIn,
- GitHub,
- portfolio,
- skills,
- bio,
- avatar optional.

Generate immutable public/internal participant identifier:

```text
HH27-P-000001
```

Do not rely on name as identity.

Allow administrators to configure which fields:
- are required,
- are optional,
- are visible to teammates,
- are visible to team-finder users,
- are visible to reviewers/judges.

---

# 10. Team System

## 10.1 Create team

Participant can choose `Create a Team`.

System creates:
- team,
- team leader membership,
- event-specific Team ID.

Example:

```text
HH27-T-00482
```

Team settings:
- team name,
- track preference,
- selected problem statement,
- description,
- skills possessed,
- skills needed,
- organization/college where relevant.

## 10.2 Invite member

Leader enters name/email.

Invitation:
- securely tokenized,
- expiring,
- one-time acceptance,
- email notification,
- dashboard notification if invitee already has account.

Invitee:
- accepts,
- creates account if needed,
- verifies email,
- completes profile,
- joins team.

## 10.3 Join via Team ID

User can enter Team ID and request membership.

Leader can:
- accept,
- reject.

All actions auditable.

## 10.4 Team constraints

Event configurable:
- min team size,
- max team size,
- cross-college team allowed,
- participant allowed in multiple teams or not,
- leader change allowed,
- team edit deadline,
- member edit deadline,
- invite expiry,
- track locking.

## 10.5 Team leader permissions

Leader may:
- edit team,
- invite/remove members according to event rules,
- select track/problem,
- submit artifacts,
- initiate payment,
- request reschedule,
- submit certain team-level forms,
- request member changes,
- manage teammate listing.

## 10.6 Team member permissions

Member may:
- view team,
- view status,
- view submission metadata,
- view payment status,
- view meetings,
- view announcements,
- join community,
- submit participant-level forms,
- complete RSVP,
- use pass/coupons.

Member must not perform leader-only changes.

---

# 11. Team Finder

## 11.1 Person looking for team

Participant can create profile:
- skills,
- desired track,
- interests,
- short intro,
- availability.

Privacy:
- email/phone hidden publicly,
- contact through platform.

## 11.2 Team looking for members

Leader creates listing:
- positions available,
- skills needed,
- description,
- track,
- team size.

## 11.3 Discovery

Filters:
- skill,
- track,
- college,
- city,
- discipline,
- availability,
- team capacity.

Actions:
- request to join,
- invite participant,
- withdraw request,
- accept/reject.

Prevent spam with rate limits.

---

# 12. Community

Build event-scoped discussion community.

Categories:
- Announcements,
- General,
- Registration Help,
- Find Teammates,
- Technical Help,
- Submission Help,
- Payment,
- Travel,
- Accommodation,
- Finale,
- custom categories.

Features:
- create post,
- reply,
- mentions,
- reactions/upvotes,
- bookmark,
- search,
- pin,
- lock,
- official answer,
- moderation,
- reports,
- notifications.

Admin/moderator tools:
- remove content,
- suspend posting,
- lock thread,
- pin,
- mark official,
- review reported content.

Use pagination and database indexes for feed/query scale.

---

# 13. Announcements and Notification Center

Announcement audience targeting:
- everyone,
- registered participants,
- leaders,
- members,
- specific round,
- selected teams,
- rejected teams,
- waitlisted teams,
- finalists,
- track,
- specific teams,
- roles.

Channels:
- in-app,
- email,
- optional push later.

Notifications:
- stored per user,
- unread count,
- mark read,
- deep link to relevant resource.

High-volume announcements must be fan-out jobs, not synchronous loops.

---

# 14. Dynamic Round Engine

Do not hard-code three rounds.

`Round` configuration includes:
- name,
- number/order,
- type,
- start time,
- end time,
- timezone,
- eligible previous states,
- submissions required,
- scoring method,
- reviewer assignment method,
- selection mode,
- max selected teams,
- blind review flag,
- interview configuration,
- status.

Round types may include:
- submission,
- review,
- interview,
- judging,
- onsite,
- custom.

Team round states:
- NOT_STARTED,
- ELIGIBLE,
- IN_PROGRESS,
- SUBMITTED,
- UNDER_REVIEW,
- SELECTED,
- WAITLISTED,
- REJECTED,
- DISQUALIFIED,
- WITHDRAWN,
- COMPLETED.

Transitions must be validated server-side and audited.

---

# 15. Generic Submission Engine

Submission requirements are admin-configurable.

Field types:
- file,
- URL,
- GitHub URL,
- video URL,
- text,
- long text,
- dropdown,
- checkbox,
- number.

Admin config:
- round,
- opening,
- deadline,
- late window,
- allowed MIME types/extensions,
- max size,
- required fields,
- replace-until time,
- revision rules.

## 15.1 Versioning

Never overwrite history.

Store:
- submission,
- versions,
- file object metadata,
- submitted_by,
- timestamp,
- checksum,
- state.

Allow current-version designation while preserving previous versions.

## 15.2 Upload architecture

Prefer:
1. API requests upload authorization.
2. Backend validates permissions/configuration.
3. Backend returns signed upload URL.
4. Client uploads directly to object storage.
5. Client confirms upload.
6. Backend validates object metadata and creates submission version.

Consider asynchronous malware scanning and quarantine state for sensitive upload types.

---

# 16. Payments

Admin config:
- registration fee,
- whether payment is enabled,
- per-team vs per-participant,
- due date,
- waiver support,
- coupon/discount if desired.

State machine:
- NOT_REQUIRED
- PENDING
- CREATED
- AUTHORIZED
- PAID
- FAILED
- REFUND_PENDING
- REFUNDED
- WAIVED

Payment workflow:
- create order server-side,
- open provider checkout,
- verify callback/webhook,
- webhook is source of truth,
- idempotent state transition,
- generate receipt metadata.

Members may see status; leader controls team-level payment where configured.

---

# 17. Review System

Reviewer portal displays assigned teams only.

Configurable rubric:
- criterion name,
- description,
- min/max score,
- weight,
- required comment,
- optional recommendation.

Features:
- save draft,
- submit,
- lock after submission,
- reopen by admin with audit reason,
- reviewer conflict-of-interest flag,
- blind review.

Admin can configure:
- reviews per team,
- reviewers per round,
- auto-assignment,
- workload limits,
- track specialization,
- college conflict rules.

Auto assignment should produce balanced workloads.

---

# 18. Judge System

Separate from reviewer role.

Judge portal:
- assigned finalists,
- team presentation details,
- rubric,
- scoring,
- notes,
- submit final evaluation.

Optional:
- score locking,
- admin reopen,
- inter-panel normalization analytics,
- tie detection,
- ranked choice if configured.

Do not expose other judges' scores until event policy permits.

---

# 19. Bulk Shortlisting and Round Transitions

Admin team table must support:
- pagination,
- filters,
- saved views if feasible,
- selection across current result set,
- explicit bulk-action confirmation.

Actions:
- select,
- reject,
- waitlist,
- disqualify,
- move to next round,
- assign reviewer,
- send communication,
- export.

For large bulk operations:
- create background job,
- show progress,
- record job outcome,
- produce error report,
- ensure idempotency.

---

# 20. Interview Scheduling

## 20.1 Configuration

Admin sets:
- selected round,
- eligible teams,
- interview date range,
- daily working windows,
- timezone,
- interview duration,
- buffer,
- interviewer pool,
- interviewer availability,
- room/meeting provider,
- max interviews/interviewer/day,
- team constraints,
- break windows.

## 20.2 Scheduler

Scheduling engine must:
- avoid interviewer conflicts,
- avoid duplicate team slots,
- respect working hours,
- respect blocked periods,
- distribute load,
- support manual override,
- support regeneration only with explicit confirmation.

Store scheduling run/version so changes are auditable.

## 20.3 Meeting generation

After slot confirmation:
- create Calendar event,
- create conference/Meet where provider supports,
- include team members,
- include interviewers,
- persist external event ID,
- persist meeting URL,
- email users,
- show dashboard card.

External API calls are queued/retried and must be idempotent.

---

# 21. Interview Rescheduling

Admin config:
- rescheduling enabled,
- maximum requests,
- latest request threshold,
- allowed alternatives,
- approval required,
- who may approve.

Leader submits:
- reason,
- requested slot.

State:
- REQUESTED
- APPROVED
- REJECTED
- CANCELLED
- EXPIRED

On approval:
- atomically reserve new slot,
- release old slot,
- update external calendar event,
- notify everyone,
- audit.

Use distributed locking or database transaction/advisory lock to avoid two teams taking the same slot.

---

# 22. Approval Workflow Engine

Generic approval requests support:
- team member change,
- leader change,
- team name change,
- track change,
- problem statement change,
- interview reschedule,
- RSVP correction,
- finalist detail change,
- other admin-configurable request types where feasible.

Core model:
- requester,
- entity,
- request type,
- payload before/after,
- reason,
- status,
- approver,
- timestamps,
- decision comment.

States:
- PENDING
- APPROVED
- REJECTED
- CANCELLED
- EXPIRED

Changes become effective only after approval where policy requires it.

---

# 23. Dynamic Form Builder

This is a major first-class module.

Admin can create arbitrary forms for:
- food,
- accommodation,
- transport,
- travel,
- T-shirt,
- emergency contact,
- accessibility,
- RSVP,
- hardware,
- reimbursement,
- feedback,
- mentor requests,
- volunteer operations,
- other future requirements.

## 23.1 Form configuration

- title,
- description,
- event,
- audience,
- opens_at,
- closes_at,
- editable_until,
- response scope (participant/team),
- required/optional,
- status (draft/published/closed/archived),
- confirmation message.

## 23.2 Audience targeting

- all participants,
- leaders,
- members,
- selected round,
- finalists,
- track,
- explicit teams,
- uploaded/imported audience,
- role.

## 23.3 Field types

- short text,
- long text,
- integer,
- decimal,
- email,
- phone,
- URL,
- date,
- time,
- datetime,
- dropdown,
- radio,
- checkboxes,
- yes/no,
- file,
- image,
- address,
- agreement/consent.

## 23.4 Conditional logic

Example:

```text
Need accommodation? = Yes
    ↓
Show:
- check-in date
- check-out date
- room preference
```

Support AND/OR conditions without allowing arbitrary executable code.

## 23.5 Response handling

- draft where configured,
- submit,
- edit until deadline,
- immutable submission version/history for important forms,
- response completion metrics,
- reminder targeting.

---

# 24. Form Reminders

Admin can schedule:
- fixed date/time reminder,
- N hours before deadline,
- recurring reminder if still incomplete.

Reminder audience must dynamically exclude completed respondents at execution time.

Use queues and scheduled jobs.

---

# 25. Excel / CSV Import Framework

The import engine must be generic and reusable.

Modules using imports:
- users,
- team data where authorized,
- food,
- accommodation,
- transport,
- venue assignments,
- panel schedules,
- custom operational fields.

## 25.1 Flow

```text
Upload file
   ↓
Parse safely
   ↓
Choose target import type
   ↓
Map columns
   ↓
Validate rows
   ↓
Preview
   ↓
Show valid/warning/error counts
   ↓
Download error rows
   ↓
Confirm
   ↓
Queue import
   ↓
Track progress
   ↓
Produce completion report
```

## 25.2 Matching

Preferred identity match:
1. participant ID,
2. team ID,
3. registered email.

Avoid name-only matching.

## 25.3 Safety

- max file size,
- supported extensions,
- worksheet selection,
- formula cells treated as values only; never execute,
- row cap/configuration,
- duplicate detection,
- idempotency key,
- transaction/batch strategy,
- explicit update-vs-create behavior,
- dry run,
- audit log,
- import run records.

## 25.4 Rollback

For operational imports where feasible, store prior values and provide controlled rollback of the import batch.

Rollback itself must be audited.

---

# 26. Excel Export Framework

Exports:
- participants,
- teams,
- payments,
- round results,
- finalist list,
- reviews,
- judging,
- RSVP,
- food,
- accommodation,
- transport,
- attendance,
- submissions metadata,
- forms,
- custom selected columns.

Large exports run asynchronously:
- queue job,
- generate XLSX,
- store securely,
- notify admin,
- signed download link with expiry.

Do not build huge XLSX files in API request memory.

---

# 27. Finalist / Offline Finale Module

When team reaches finalist stage, participant dashboard reveals configurable finalist workflow.

Possible required actions:
- RSVP,
- member confirmation,
- travel details,
- food form,
- accommodation form,
- transport form,
- identity verification,
- final submission,
- emergency details,
- venue reporting acknowledgement.

Admin decides which tasks are required.

Dashboard shows:
- completion checklist,
- deadlines,
- assigned venue,
- panel,
- presentation slot,
- pass,
- operational information.

---

# 28. RSVP

Support response scope per participant.

Fields configurable through dynamic form, but provide an RSVP-specific summary state:
- attending,
- not attending,
- pending.

Team leader sees status of each member.

Admin sees:
- confirmed,
- declined,
- pending,
- team completeness.

Member changes after RSVP require policy/approval handling.

---

# 29. Accommodation Operations

## 29.1 Inventory

Admin can create/import:
- site/campus,
- building/hostel,
- floor,
- room,
- bed/capacity,
- attributes,
- availability.

## 29.2 Assignment

Support:
- manual assignment,
- bulk assignment,
- import assignment,
- auto-assignment later if rules configured.

Participant sees only their assignment and necessary instructions.

## 29.3 Check-in/out

Optional accommodation check-in records with coordinator permission.

---

# 30. Food Operations

## 30.1 Meal plans

Admin config:
- day,
- meal type,
- serving window,
- eligible audience,
- location,
- entitlement rule.

## 30.2 Dietary requirements

Collected via dynamic form.

## 30.3 Food coupon

Each entitlement is unique and redeemable once.

Do not encode personal details directly into QR.

QR contains opaque/signed token.

Redemption:
- coordinator scans,
- server verifies entitlement,
- checks unused,
- atomically redeems,
- returns participant-safe confirmation.

Must be concurrency-safe: two scanners cannot redeem the same entitlement twice.

## 30.4 Offline support

Coordinator PWA should provide limited degraded behavior during unstable venue connectivity.

Recommended strategy:
- prefetch minimal encrypted/limited entitlement dataset for assigned event scope,
- locally record pending scans,
- synchronize when connection returns,
- detect conflicts,
- never expose full participant database to scanners.

If secure offline redemption is too complex for first release, build online-first scanner with explicit connectivity warning, but architecture must not pretend offline behavior exists.

---

# 31. Transport Operations

Admin manages:
- pickup/drop locations,
- routes,
- trips,
- date/time,
- vehicles,
- capacity,
- driver/contact data,
- coordinator,
- participant assignments.

Assignments can be:
- manual,
- bulk,
- imported.

Participant sees:
- pickup location,
- reporting time,
- route/trip,
- vehicle,
- only contact information intended for participant visibility.

Capacity constraints enforced.

---

# 32. Travel Module

Participant-provided:
- arrival mode,
- station/airport,
- carrier,
- train/flight/bus number,
- arrival date/time,
- departure information.

Can be collected with dynamic forms but normalized fields are helpful for transport operations.

Admin may filter arrivals by:
- location,
- time window,
- transport need.

---

# 33. Venue, Panel and Presentation Scheduling

Models:
- venue,
- building,
- room,
- panel,
- judge assignment,
- slot,
- team slot.

Admin can:
- create/import rooms,
- create panels,
- assign judges,
- set operating hours,
- schedule teams,
- move teams,
- lock published schedule.

Participant sees:
- building,
- room,
- panel,
- reporting time,
- presentation time,
- map/instructions.

Schedule changes after publish:
- require audit reason,
- trigger notification/email if configured.

---

# 34. Entry Pass and QR Access

Each eligible participant receives signed/opaque pass token.

Pass UI:
- participant name,
- team,
- participant ID,
- event,
- role/status,
- QR.

Never put raw sensitive data into QR payload.

Scanner flow:
1. camera scan,
2. verify token,
3. return current access state,
4. check in/out,
5. write immutable access event.

Entry/exit history:
- timestamp,
- gate,
- scanner user/device,
- direction,
- result.

Prevent accidental repeated scans with short duplicate-scan guard.

---

# 35. Coordinator Portal

Student Coordinator receives scoped operational UI only.

Possible permissions:
- check-in scanner,
- food scanner,
- accommodation desk,
- transport desk,
- help desk,
- room lookup,
- participant/team lookup with limited fields.

Do not give:
- payment internals,
- review scores,
- private judge comments,
- user credential data,
- full admin configuration.

Support permission-scoped coordinator assignments.

---

# 36. Analytics

## 36.1 Admin overview

Metrics:
- accounts,
- verified users,
- teams,
- team completion,
- registrations,
- payments,
- submissions,
- selected/waitlisted/rejected,
- reviews completed,
- finalist count,
- RSVP,
- operational forms completion.

## 36.2 Registration funnel

```text
Account Created
   ↓
Email Verified
   ↓
Team Created/Joined
   ↓
Team Complete
   ↓
Registration Complete
   ↓
Submission Complete
   ↓
Payment Complete
```

## 36.3 Breakdown dimensions

- date,
- track,
- college,
- state,
- team size,
- round,
- reviewer,
- submission status,
- payment status,
- RSVP.

## 36.4 Event-day dashboard

- expected finalists,
- checked in,
- currently onsite,
- presentation progress,
- food redemption,
- transport arrivals,
- accommodation check-in,
- unresolved operational issues.

## 36.5 Analytics correctness

Metrics need explicit definitions.

Do not mix event timestamps/timezones incorrectly.

Analytics endpoints must aggregate in database/materialized tables rather than fetching all rows into Node memory.

For expensive recurring analytics, use cached aggregates/materialized views and refresh jobs.

---

# 37. Search

Global admin search can search:
- participant ID,
- team ID,
- email,
- participant name,
- team name,
- college.

Use PostgreSQL indexes and trigram/full-text strategy where appropriate.

Search endpoints:
- debounced,
- rate limited,
- paginated,
- permission filtered.

Never return unauthorized fields in search payload.

---

# 38. Audit Logging

Critical operations must create audit events.

Audit fields:
- event ID,
- actor user ID,
- actor role/context,
- action,
- entity type,
- entity ID,
- before JSON where appropriate,
- after JSON where appropriate,
- reason,
- IP,
- user agent,
- correlation ID,
- timestamp.

Audit actions include:
- permission changes,
- round transitions,
- shortlist changes,
- team member changes,
- approvals,
- schedule changes,
- payment admin changes,
- submission reopen,
- score reopen,
- imports,
- exports,
- pass overrides,
- coupon overrides,
- CMS publication.

Audit records should be append-only to application users.

---

# 39. Email Template System

Templates:
- email verification,
- password reset,
- team invitation,
- join request,
- membership accepted,
- registration complete,
- payment confirmation,
- submission confirmation,
- deadline reminder,
- selected,
- waitlisted,
- rejected,
- interview scheduled,
- interview changed,
- reschedule decision,
- finalist congratulations,
- RSVP reminder,
- venue assignment,
- transport assignment,
- accommodation assignment,
- results,
- certificate.

Template requirements:
- event branding,
- preview,
- variables,
- HTML + text fallback,
- test send,
- versioning where appropriate.

Track:
- queued,
- sent,
- failed,
- provider message ID.

Avoid logging full sensitive email bodies unnecessarily.

---

# 40. Notification Jobs

Queue types may include:
- email.send,
- email.bulk,
- notification.fanout,
- submission.scan,
- export.generate,
- import.process,
- analytics.refresh,
- interview.generate,
- calendar.sync,
- payment.reconcile,
- reminder.process,
- certificate.generate.

Each job needs:
- idempotency strategy,
- retry policy,
- exponential backoff,
- dead-letter/failure inspection,
- structured logs.

Admin should have a job/operations view for failed important jobs.

---

# 41. Caching Strategy

Use caching selectively.

Cache candidates:
- public event configuration,
- public CMS pages,
- tracks/problem statements,
- role/permission resolution short TTL,
- analytics aggregates,
- feature flags.

Do not cache mutable security-sensitive authorization results for dangerously long periods.

Implement explicit invalidation after admin changes.

Use CDN caching for public anonymous routes.

---

# 42. Database Design Principles

## 42.1 IDs

Use UUID/UUIDv7/CUID2 internal IDs.

Use separate human-readable IDs:
- `HH27-P-000001`
- `HH27-T-000001`

Never expose auto-increment IDs as authorization boundaries.

## 42.2 Timestamps

Store timestamps in UTC.

Store event timezone as IANA timezone, e.g. `Asia/Kolkata`.

Convert at presentation layer.

## 42.3 Soft delete

Use soft deletion only where business/legal history requires it. Do not blindly soft-delete everything.

Audit and status history should preserve essential records.

## 42.4 Indexing

Indexes required on common combinations including:
- event_id + status,
- event_id + email where applicable,
- event_id + human IDs,
- team memberships,
- round participation,
- submission status/deadlines,
- reviewer assignment,
- scheduled slot start/end,
- form response completion,
- notification user/read state,
- audit entity/time,
- import/export owner/time.

Review query plans for largest admin views.

---

# 43. Suggested Core Data Model

This is conceptual; normalize as engineering requires.

```text
User
UserCredential
UserSession
EmailVerification
PasswordReset
UserProfile

Event
EventBranding
EventSetting
EventRoleAssignment
Role
Permission
RolePermission

CmsPage
CmsRevision
Faq
Track
ProblemStatement
Prize
Sponsor
PersonProfile
TimelineItem

Participant
Team
TeamMember
TeamInvitation
TeamJoinRequest
TeamRequirement
TeamFinderProfile

Round
RoundRequirement
TeamRoundParticipation
RoundTransition

SubmissionDefinition
Submission
SubmissionVersion
StoredObject

Payment
PaymentAttempt
PaymentWebhookEvent
PaymentRefund

EvaluationRubric
EvaluationCriterion
ReviewerAssignment
Evaluation
EvaluationScore
ConflictOfInterest

InterviewConfiguration
InterviewerAvailability
InterviewSlot
Interview
ExternalCalendarEvent
RescheduleRequest

DynamicForm
DynamicFormField
DynamicFormCondition
DynamicFormAudience
FormResponse
FormResponseVersion
FormAnswer

Announcement
Notification
EmailTemplate
EmailMessage

CommunityCategory
CommunityPost
CommunityComment
CommunityReaction
CommunityReport

ApprovalRequest

ImportRun
ImportColumnMap
ImportRowResult
ExportRun

AccommodationSite
AccommodationBuilding
AccommodationRoom
AccommodationBed
AccommodationAssignment

MealPlan
MealEntitlement
MealRedemption

TransportLocation
TransportRoute
TransportVehicle
TransportTrip
TransportAssignment

TravelRecord

Venue
VenueRoom
Panel
PanelJudge
PresentationSlot

ParticipantPass
AccessEvent
ScannerDevice

RSVPRecord

AuditLog
BackgroundJobReference
```

---

# 44. API Design

Use versioned REST API:

```text
/api/v1/...
```

Generate OpenAPI documentation.

Use consistent response/error contract.

Example error:

```json
{
  "error": {
    "code": "TEAM_FULL",
    "message": "This team has reached the maximum allowed size.",
    "requestId": "req_..."
  }
}
```

Do not expose stack traces to clients.

Support pagination:
- cursor pagination for large feeds/tables where practical,
- offset pagination acceptable for bounded admin views if query performance is verified.

---

# 45. Concurrency and Consistency

Critical race conditions must be explicitly protected:

- joining a team when only one seat remains,
- accepting invitation and join request simultaneously,
- changing team leader,
- final submission near deadline,
- payment webhook duplicates,
- interview slot reservation,
- reschedule slot assignment,
- meal coupon double redemption,
- entry scan duplicate actions,
- bulk shortlist transitions,
- form deadline submissions.

Use:
- database transactions,
- unique constraints,
- row locking where appropriate,
- optimistic concurrency/version columns,
- Redis distributed locks only when database locking cannot solve safely,
- idempotency keys.

Never rely solely on frontend disabling buttons.

---

# 46. Security

## 46.1 Baseline

- OWASP guidance.
- Strict CSP.
- secure cookies.
- CSRF strategy appropriate to auth/session design.
- XSS prevention.
- SQL injection avoided through ORM/parameterization.
- SSRF prevention for server-side URL fetching.
- rate limiting.
- file upload security.
- safe redirect validation.
- security headers.
- dependency vulnerability scanning.
- secret rotation process.

## 46.2 Data protection

- TLS everywhere.
- encrypt managed databases/storage at rest.
- avoid unnecessary PII collection.
- define retention policies.
- role-based visibility.
- redact PII from logs.
- sensitive exports authorized and expiring.

## 46.3 Admin security

- MFA.
- stronger session controls.
- session revocation.
- audit logs.
- optional IP/security alerting.
- step-up authentication for extremely sensitive actions if feasible.

---

# 47. Privacy

Admin-created forms may collect sensitive information accidentally.

Form builder should:
- show privacy warning for sensitive fields,
- allow admin to define purpose,
- allow admin to define visibility,
- allow admin to define retention period where appropriate.

Do not make participant information publicly searchable unless explicitly configured.

Team-finder profiles must be opt-in.

---

# 48. Accessibility

- keyboard navigable,
- visible focus states,
- semantic controls,
- accessible dialogs,
- screen-reader labels,
- color contrast,
- responsive text,
- reduced motion support,
- meaningful errors tied to fields.

Admin tables must remain usable with keyboard and smaller screens where practical.

---

# 49. Responsive Design

Participant portal must be excellent on mobile.

Priority mobile experiences:
- registration,
- team invitations,
- dashboard status,
- forms,
- interview link,
- QR pass,
- venue information,
- notifications.

Coordinator scanner interface should be mobile-first/PWA.

Admin large-table workflows may optimize for desktop but still provide responsive fallbacks.

---

# 50. Design System

Create reusable primitives:
- Button
- Input
- Select
- Combobox
- DataTable
- StatusBadge
- EmptyState
- ErrorState
- Skeleton
- FormField
- Dialog
- Sheet
- Drawer
- Toast
- Timeline
- DashboardCard
- KPI
- ChartCard
- FileUploader
- ImportWizard
- QRScanner
- PermissionGuard UI helper
- RichText
- DateTime display respecting event timezone.

Use consistent status vocabulary and colors.

---

# 51. Participant Dashboard

Core areas:
- event status,
- team,
- next action,
- progression timeline,
- required tasks,
- submissions,
- payment status,
- interview,
- announcements,
- forms,
- finalist operations when eligible,
- QR pass when eligible.

Example progression:

```text
✓ Account
✓ Team
✓ Registration
✓ Round 1 Submission
✓ Round 1 Review
● Round 2 Interview
○ Final Selection
○ RSVP
○ Finale
```

Do not expose internal scores unless admin config permits.

---

# 52. Team Leader Dashboard

Additional sections:
- team management,
- invitations,
- join requests,
- registration completeness,
- payments,
- submissions,
- reschedule actions,
- team-level forms,
- approval requests,
- teammate recruitment.

---

# 53. Admin Information Architecture

Suggested navigation:

```text
Overview

Event
├── Settings
├── Branding
├── CMS
├── Timeline
├── Tracks
├── Problem Statements
└── Rules

Participants
├── Users
├── Teams
├── Team Finder
└── Approvals

Competition
├── Rounds
├── Submissions
├── Reviews
├── Judges
├── Shortlisting
└── Results

Interviews
├── Configuration
├── Interviewers
├── Availability
├── Schedule
└── Reschedules

Operations
├── Forms
├── RSVP
├── Food
├── Accommodation
├── Transport
├── Travel
├── Venue
├── Panels
├── Passes
└── Entry / Exit

Communication
├── Announcements
├── Email Templates
├── Notifications
└── Community Moderation

Data
├── Imports
├── Exports
└── Audit Logs

Analytics

Administration
├── Roles
├── Permissions
├── Integrations
├── Background Jobs
└── System Health
```

---

# 54. Reviewer Information Architecture

```text
Reviewer Home
├── Assigned Teams
├── Pending Reviews
├── Completed Reviews
└── Profile / Conflict Declarations
```

No admin nav.

---

# 55. Judge Information Architecture

```text
Judge Home
├── Assigned Finalists
├── Schedule
├── Scorecards
└── Submitted Scores
```

---

# 56. Coordinator Information Architecture

Permission-dependent:

```text
Coordinator Home
├── Entry Scanner
├── Food Scanner
├── Participant Lookup
├── Transport
├── Accommodation
└── Venue Schedule
```

---

# 57. Status Model

Avoid loose booleans.

Participant:
- INVITED
- REGISTERED
- VERIFIED
- ACTIVE
- SUSPENDED
- WITHDRAWN

Team:
- DRAFT
- INCOMPLETE
- REGISTERED
- LOCKED
- WITHDRAWN
- DISQUALIFIED

Submission:
- DRAFT
- SUBMITTED
- LATE
- LOCKED
- INVALIDATED

Evaluation:
- DRAFT
- SUBMITTED
- REOPENED
- LOCKED

Interview:
- UNSCHEDULED
- SCHEDULED
- RESCHEDULE_REQUESTED
- COMPLETED
- CANCELLED
- NO_SHOW

Finalist:
- NOT_FINALIST
- SELECTED
- RSVP_PENDING
- CONFIRMED
- DECLINED
- WITHDRAWN

Use enums/state-machine guards.

---

# 58. Event Configuration

Admin-configurable:
- event name,
- slug,
- timezone,
- registration dates,
- participant eligibility,
- min/max team size,
- payment settings,
- team modification deadlines,
- track rules,
- problem selection rules,
- round definitions,
- scoring,
- interview rules,
- forms,
- RSVP,
- finale settings,
- operation modules,
- notification policies.

Configuration changes that materially affect participants must be audited.

---

# 59. Feature Flags

Use event-scoped feature flags for optional modules:
- community,
- team finder,
- payments,
- interviews,
- accommodation,
- food,
- transport,
- QR entry,
- certificates.

Feature flag disabled:
- hide routes/navigation,
- backend rejects operations cleanly,
- retain data.

---

# 60. Background Processing and Peak Traffic

Submission deadlines and result releases are burst events.

Requirements:
- API must never send thousands of emails synchronously.
- exports/imports async.
- calendar generation async.
- result fanout async.
- large shortlisting transitions async.
- reminders async.

Autoscaling signals:
- API CPU/memory/request count,
- worker queue depth,
- worker CPU,
- database load,
- Redis load.

Consider scheduled temporary capacity increases before known deadlines.

---

# 61. Database Connection Management

When horizontally scaling API/worker instances:
- enforce connection pool limits,
- use pooling/proxy,
- prevent each container from opening excessive connections,
- tune RDS max connections,
- monitor pool exhaustion,
- set query timeouts.

This is mandatory before production load testing.

---

# 62. Load Testing

Use k6 or Artillery.

Required scenarios:

1. Registration burst.
2. Login burst.
3. Team dashboard reads.
4. Team invitation flow.
5. Submission presign + metadata confirmation.
6. Submission deadline burst.
7. Result publication/read burst.
8. Admin team filtering.
9. Form submission.
10. QR check-in burst.
11. Food redemption burst.

Test at projected peak and beyond.

Capture:
- p50/p95/p99,
- error rate,
- DB CPU,
- connection usage,
- Redis,
- queue depth,
- API CPU/memory.

Do not claim scale readiness without running load tests.

---

# 63. Automated Testing

## Unit tests

Business rules:
- team size,
- round transitions,
- permissions,
- deadlines,
- scoring,
- rescheduling,
- coupon redemption,
- imports,
- form conditions.

## Integration tests

- database repositories,
- API endpoints,
- auth,
- payment webhook,
- calendar adapter mocks/contracts,
- storage adapter,
- queue processing.

## E2E

Playwright flows:
- register user,
- verify test email flow,
- create team,
- invite member,
- join team,
- submit,
- admin shortlist,
- reviewer score,
- interview schedule,
- finalist flow,
- form,
- QR operations.

## Security tests

- unauthorized resource access,
- IDOR attempts,
- privilege escalation,
- invalid file uploads,
- webhook tampering,
- rate-limit verification.

---

# 64. CI/CD

On PR:
- install locked dependencies,
- lint,
- typecheck,
- unit tests,
- integration tests,
- build,
- migration validation,
- security/dependency scan.

On merge:
- build immutable containers,
- push to registry,
- deploy staging,
- run smoke tests.

Production:
- manual/controlled promotion,
- pre-deploy migration strategy,
- health checks,
- rolling deployment,
- rollback.

Never run unsafe destructive migrations during active event peak.

---

# 65. Database Migration Discipline

Use expand/contract strategy for large or risky migrations:
1. add backward-compatible schema,
2. deploy code supporting both,
3. backfill async,
4. switch reads/writes,
5. remove old field later.

Production migration files must be reviewed and committed.

---

# 66. Backups and Disaster Recovery

Production:
- RDS automated backups,
- point-in-time recovery,
- periodic restore drills,
- object storage versioning where practical,
- infrastructure as code,
- documented recovery steps.

Define RPO/RTO targets before event launch.

Recommended starting operational goals:
- RPO <= 5–15 minutes for critical relational data where provider supports.
- RTO <= 1 hour target for major incidents.

---

# 67. Monitoring and Alerts

Alerts:
- API 5xx spike,
- p95 latency degradation,
- DB CPU,
- DB connection saturation,
- replication/storage issues,
- Redis memory,
- queue backlog,
- failed job spike,
- email provider failures,
- payment webhook failures,
- object storage failures,
- disk/container restarts.

Dashboard:
- requests,
- latency,
- errors,
- queue depth,
- DB health,
- external integration health.

---

# 68. Integration Failure Behavior

Google unavailable:
- keep interview record,
- mark calendar sync pending/failed,
- retry,
- admin can retry,
- dashboard indicates meeting setup issue only to appropriate admin until resolved.

Email unavailable:
- persist notification,
- queue retries,
- show delivery status to admin.

Payment provider unavailable:
- no false success,
- preserve order,
- retry/reconcile safely.

Storage unavailable:
- block upload completion safely.

---

# 69. Idempotency

Required for:
- payment webhooks,
- calendar creation,
- bulk transitions,
- imports,
- email fanout,
- coupon redemption,
- pass scans where appropriate,
- submission finalization,
- reschedule approval.

Persist idempotency keys/results where necessary.

---

# 70. Time and Deadline Handling

Event timezone is configurable.

Store all instants UTC.

Display using event timezone by default.

Deadline validation must happen server-side.

Define grace behavior explicitly.

Use database/server time, never trust browser clock for final eligibility.

---

# 71. Admin Analytics and Data Privacy

Analytics must not expose sensitive operational fields to users lacking permission.

Student coordinators may get counts relevant to operations without financial/reviewer details.

Reviewers should not see global analytics unless authorized.

---

# 72. Data Import Examples

## Food

```csv
participant_id,breakfast,lunch,dinner,preference
HH27-P-001,true,true,true,vegetarian
```

## Accommodation

```csv
participant_id,building,room,bed,check_in,check_out
HH27-P-001,Block A,203,B1,2027-09-25,2027-09-27
```

## Transport

```csv
participant_id,trip_code,pickup_location,pickup_time
HH27-P-001,BUS-03,Airport Gate 2,2027-09-25T08:30:00+05:30
```

Importer must map custom column names rather than requiring these exact headers.

---

# 73. Certificate Module

Recommended implementation.

Admin config:
- eligible status,
- certificate template,
- signer metadata,
- certificate type.

Generate:
- participation,
- finalist,
- winner,
- judge/reviewer/volunteer if needed.

Each certificate:
- unique verification ID,
- QR verification URL,
- generated PDF,
- public verification page exposing only appropriate data.

Generation is asynchronous.

---

# 74. Results

Admin can:
- prepare draft,
- validate,
- publish atomically,
- unpublish only with super-admin permission and audit reason.

Participant result:
- round status,
- public comments if configured.

Public results:
- winners,
- awards,
- team name,
- project,
- permitted public members/details.

Do not accidentally expose private scores.

---

# 75. Support / Help Desk

Community covers general questions, but support cases may contain private information.

Provide lightweight ticketing:
- category,
- participant/team,
- description,
- attachments,
- assigned admin,
- status,
- replies.

Statuses:
- OPEN,
- IN_PROGRESS,
- WAITING_USER,
- RESOLVED,
- CLOSED.

---

# 76. Error and Empty States

Every page must define:
- loading,
- no data,
- permission denied,
- network error,
- server error,
- validation error,
- deadline closed,
- feature disabled.

Never render blank white pages.

---

# 77. Seed Data

Provide:
- `pnpm db:seed:dev`

Development seed may create:
- test event,
- test admin,
- sample participants,
- sample teams,
- sample rounds.

Seed data must never run automatically in production.

No production interface should depend on seed records.

---

# 78. Documentation

Required documents:

```text
README.md
docs/ARCHITECTURE.md
docs/LOCAL_DEVELOPMENT.md
docs/DEPLOYMENT.md
docs/DATABASE.md
docs/AUTHORIZATION.md
docs/IMPORT_EXPORT.md
docs/INTEGRATIONS.md
docs/OPERATIONS.md
docs/SECURITY.md
docs/INCIDENT_RESPONSE.md
docs/BACKUP_RESTORE.md
docs/LOAD_TESTING.md
docs/ADMIN_GUIDE.md
```

OpenAPI generated documentation should also exist.

---

# 79. Environment Configuration

Provide `.env.example`.

Examples:
- DATABASE_URL
- DIRECT_DATABASE_URL if needed
- REDIS_URL
- STORAGE_ENDPOINT
- STORAGE_BUCKET
- AWS region
- SES credentials/role configuration
- Razorpay IDs/secrets
- Google OAuth/service credentials
- encryption secrets
- session secrets
- Sentry/OpenTelemetry endpoints.

Validate environment at startup and fail fast if required configuration is missing.

---

# 80. Infrastructure as Code

Use Terraform for production infrastructure where practical.

Modules:
- networking,
- load balancer,
- ECS,
- RDS,
- Redis,
- storage,
- secrets,
- monitoring,
- DNS as appropriate.

Production infrastructure must be reproducible.

---

# 81. Suggested Delivery Phases

These phases are development ordering, not permission to leave mocks.

## Phase 0 — Engineering foundation

Complete:
- monorepo,
- lint/typecheck/test,
- Docker local environment,
- database,
- migrations,
- config,
- logging,
- tracing,
- CI.

## Phase 1 — Identity and event foundation

Complete:
- auth,
- verification,
- reset,
- users/profiles,
- event model,
- RBAC,
- admin roles,
- audit.

## Phase 2 — Public website + CMS

Complete all public routes and CMS backing.

## Phase 3 — Team lifecycle

Complete teams, invitations, joining, finder, permissions.

## Phase 4 — Registration, payments, submissions

Complete configurable registration, submission engine, payments.

## Phase 5 — Rounds and evaluation

Complete round engine, reviewer/judge, scoring, shortlist.

## Phase 6 — Interviews

Complete availability, scheduler, Calendar/Meet, rescheduling.

## Phase 7 — Dynamic forms and data operations

Complete form builder, reminders, import/export.

## Phase 8 — Finalist operations

Complete RSVP, food, accommodation, transport, travel.

## Phase 9 — Offline event operations

Complete venue/panels, QR passes, entry/exit, food scanning.

## Phase 10 — Analytics, hardening and load readiness

Complete dashboards, observability, performance tests, security review, backup restore test.

A phase is complete only when its features satisfy the Definition of Done below.

---

# 82. Definition of Done for EVERY Feature

A feature is complete only if:

- [ ] Requirements implemented.
- [ ] Database migration exists if data is persisted.
- [ ] Authorization enforced server-side.
- [ ] Input schemas and validation implemented.
- [ ] Business rules implemented.
- [ ] API documented.
- [ ] UI implemented.
- [ ] Loading state implemented.
- [ ] Empty state implemented.
- [ ] Error state implemented.
- [ ] Success feedback implemented.
- [ ] Mobile behavior verified where relevant.
- [ ] Audit event implemented where required.
- [ ] Unit tests added.
- [ ] Integration tests added where applicable.
- [ ] E2E critical flow added where applicable.
- [ ] Observability/logging added.
- [ ] Documentation updated.
- [ ] No TODO placeholder represents required functionality.
- [ ] No mock data is used in runtime production path.
- [ ] Permissions tested with unauthorized role.
- [ ] Performance/query behavior reviewed for large lists.

---

# 83. Production Readiness Gate

Do not call the system production-ready until:

- [ ] Automated test suite passes.
- [ ] Staging mirrors production topology closely enough.
- [ ] Load tests meet agreed targets.
- [ ] Admin MFA enabled.
- [ ] Backups enabled.
- [ ] Restore tested.
- [ ] Monitoring dashboards working.
- [ ] Alerts tested.
- [ ] Error tracking working.
- [ ] Queue failure handling tested.
- [ ] Payment webhook tested.
- [ ] Calendar integration tested.
- [ ] Email deliverability configured (SPF/DKIM/DMARC).
- [ ] File access rules reviewed.
- [ ] Authorization test suite passes.
- [ ] Security headers checked.
- [ ] Dependency scan reviewed.
- [ ] RDS/DB connection pool tuned.
- [ ] CDN/WAF rules configured.
- [ ] Critical deadline flows tested under load.
- [ ] Result publication tested under load.
- [ ] Event-day QR scans tested on real devices.

---

# 84. UX Quality Standard

The product must not feel like an admin template stitched together.

Public website:
- premium modern HealthTech identity,
- polished motion,
- strong typography,
- excellent responsive layout,
- event energy without visual clutter.

Participant experience:
- clear next action,
- clear status,
- minimal confusion,
- deadline visibility,
- mobile first.

Admin:
- data dense but clean,
- strong filters,
- bulk operations,
- safe confirmations,
- fast workflows,
- visible system state.

Reviewer/Judge:
- distraction-free,
- keyboard-friendly scoring,
- clear save/submit distinction.

Coordinator:
- huge scan targets,
- high contrast,
- fast feedback,
- usable on mobile in crowded venue conditions.

---

# 85. Important Business Rules to Make Configurable

Never hard-code:
- max/min team members,
- leader/member privileges beyond baseline permission system,
- registration deadline,
- payment deadline,
- fee,
- track availability,
- number of rounds,
- round type,
- round dates,
- submission requirements,
- reviewer count,
- scores/weights,
- selection threshold,
- shortlist capacity,
- interview dates,
- duration,
- buffer,
- reschedule count,
- reschedule cutoff,
- approval requirement,
- RSVP dates,
- finale dates,
- form questions,
- food types,
- accommodation form requirements,
- transport form requirements,
- venue/panel configuration,
- coupon rules,
- certificate eligibility.

---

# 86. Explicitly Forbidden Shortcut Patterns

Codex must reject these shortcuts:

```text
// TODO: connect backend
// Mock data for now
alert("Coming soon")
console.log("submit")
href="#"
button with no handler
setTimeout pretending external API succeeded
hard-coded selected teams
hard-coded chart numbers
hard-coded admin role in browser
localStorage as primary database
client-side-only permission checks
using participant name as unique key
direct public S3 URLs for protected files
plain-text passwords
fake payment success
fake email status
fake calendar links
```

If a production integration cannot be configured locally, implement:
- provider interface,
- real production adapter,
- local development adapter,
- documented environment setup,
- contract/integration tests.

---

# 87. Codex Working Method

Codex should:

1. Read this entire file before implementation.
2. Create a requirements traceability checklist.
3. Build architecture and schema before broad UI generation.
4. Implement vertical slices end-to-end.
5. Run tests after every significant module.
6. Fix failing tests immediately.
7. Keep migrations small and reviewable.
8. Keep documentation updated.
9. Avoid rewriting stable modules unnecessarily.
10. Mark a feature complete only against the Definition of Done.
11. Maintain `docs/IMPLEMENTATION_STATUS.md` with:
    - implemented,
    - tests,
    - known issues,
    - remaining requirements.
12. Do not mark anything complete if the UI is present but backend is missing.
13. Before final delivery, search the codebase for:
    - TODO,
    - FIXME,
    - mock,
    - placeholder,
    - coming soon,
    - `href="#"`,
    - hardcoded sample metrics,
    and resolve all user-facing required cases.

---

# 88. First Implementation Tasks for Codex

Start in this order:

1. Initialize monorepo.
2. Add strict TypeScript, linting, formatting, test setup.
3. Add local Docker services: PostgreSQL, Redis, MinIO, Mailpit.
4. Build typed configuration system.
5. Create database package and migration process.
6. Implement User/Event/RBAC/Audit schema.
7. Implement auth and session management.
8. Implement event-aware authorization policies.
9. Build app shell and design system.
10. Build first vertical slice:
    - user registration,
    - email verification,
    - login,
    - profile,
    - create team,
    - invite member,
    - accept invite,
    - team dashboard,
    - admin team lookup,
    - audit trail.
11. Add tests.
12. Only after this vertical slice is fully functioning should subsequent modules be implemented.

---

# 89. Acceptance Scenarios

The final platform must pass these examples.

## Scenario A — New leader

1. User registers.
2. Verifies email.
3. Completes profile.
4. Creates team.
5. Receives Team ID.
6. Invites member.
7. Member receives real queued email.
8. Member accepts.
9. Member creates account/sets password if necessary.
10. Team membership becomes active.
11. Leader sees member.
12. Audit record exists.

## Scenario B — Join with Team ID

1. User enters Team ID.
2. Sees safe public team details.
3. Requests joining.
4. Leader receives notification.
5. Leader accepts.
6. Capacity checked transactionally.
7. User joins.
8. Duplicate membership impossible.

## Scenario C — Round submission

1. Admin creates round.
2. Admin defines PPT requirement.
3. Eligible leader uploads.
4. Object goes to secure storage.
5. Submission is finalized.
6. Member sees submitted state.
7. New revision retains old one.
8. Deadline enforced on server.

## Scenario D — Review and selection

1. Admin assigns reviewers.
2. Reviewer sees only assigned teams.
3. Reviewer scores rubric.
4. Reviewer submits.
5. Admin sees aggregate.
6. Admin bulk selects teams.
7. Transition job completes.
8. Selected users receive notifications/email.
9. Audit records exist.

## Scenario E — Interview

1. Admin configures slots.
2. Scheduler generates non-conflicting schedule.
3. Calendar/Meet sync occurs.
4. All members see meeting.
5. Leader requests reschedule.
6. Admin approves.
7. Slot updated atomically.
8. Calendar updated.
9. Notifications sent.

## Scenario F — Dynamic accommodation form

1. Admin builds accommodation form.
2. Targets finalists.
3. Participants receive task.
4. Conditional questions work.
5. Responses save.
6. Admin sees completion analytics.
7. Non-responders receive reminder.

## Scenario G — Excel accommodation import

1. Admin uploads spreadsheet.
2. Maps participant ID and room fields.
3. Preview displays valid/errors.
4. Admin confirms.
5. Import runs in background.
6. Assignments update.
7. Participants see rooms.
8. Import audit record exists.
9. Error report downloadable.

## Scenario H — Food redemption

1. Finalist has lunch entitlement.
2. Coordinator scans pass.
3. Entitlement displays.
4. Redeem.
5. Second scanner cannot redeem same meal.
6. Timestamp/scanner logged.

## Scenario I — Event check-in

1. Participant QR scanned.
2. Identity/status verified.
3. Check-in recorded.
4. Dashboard occupancy updates.
5. Exit scan creates new immutable event.

---

# 90. Final Deliverables

Codex must deliver:

- complete source code,
- database schema/migrations,
- Docker local environment,
- production Dockerfiles,
- infrastructure configuration,
- CI/CD workflows,
- tests,
- load tests,
- OpenAPI docs,
- operational docs,
- admin docs,
- environment example,
- seed script,
- monitoring configuration,
- import templates,
- deployment instructions.

The repository should be usable by another engineering team without needing undocumented knowledge from the original developer.

---

# 91. MASTER CODEX PROMPT

Copy the following into Codex when starting the build:

---

You are the principal software engineer responsible for building the production HealthHack Event Platform.

Read `HEALTHHACK_2027_MASTER_SPEC.md` completely before writing implementation code. Treat it as the authoritative product and engineering specification.

Your task is to build the ENTIRE platform described in that file, end-to-end, to production quality.

This is not a prototype, UI concept, hackathon demo, or mock project.

STRICT RULES:

- Do not use mock runtime data.
- Do not create fake APIs.
- Do not create buttons that do nothing.
- Do not create placeholder pages.
- Do not leave required TODO/FIXME functionality.
- Do not write "coming soon" for a required feature.
- Do not expose navigation to incomplete modules.
- Do not hard-code business rules that the specification says must be configurable.
- Do not implement authorization only in the frontend.
- Do not fake email, payment, meeting, storage, queue, import, export, analytics, QR, or scheduling behavior.
- Do not silently ignore errors.
- Do not trust client-provided roles, IDs, ownership, status, or eligibility.
- Do not use production shortcuts that prevent horizontal scaling.
- Do not declare a feature complete until its database, backend, permissions, validation, frontend, states, tests, logging, and documentation are all implemented.

The system must be designed for 10,000+ registered users and burst traffic around registration deadlines, submission deadlines, result announcements, interviews and onsite scanning.

Use the architecture in the specification:
- Next.js + TypeScript frontend,
- NestJS backend,
- PostgreSQL,
- Prisma,
- Redis,
- BullMQ workers,
- S3-compatible object storage,
- real email/provider adapters,
- Razorpay provider abstraction,
- Google Calendar/Meet integration,
- OpenTelemetry/structured logging,
- horizontally scalable stateless APIs and separate workers.

Prefer a modular monolith with strong domain boundaries instead of premature microservices.

Before broad feature implementation:

1. Inspect the specification.
2. Create `docs/IMPLEMENTATION_STATUS.md`.
3. Create a requirement traceability matrix mapping specification sections to modules/tests.
4. Create the monorepo and engineering foundation.
5. Create database architecture.
6. Implement authentication, RBAC and audit logging.
7. Build the first complete vertical slice.
8. Run all tests.
9. Continue module by module.

For every module:
- design schema,
- create migrations,
- implement policies,
- implement services,
- implement APIs,
- implement UI,
- implement error/loading/empty/success states,
- add unit/integration/E2E tests,
- add observability,
- update documentation,
- run tests before moving on.

Whenever external credentials are unavailable locally, create:
- a clean provider interface,
- the real production adapter,
- a local development adapter,
- integration/contract tests,
- documented environment variables.

Do not replace the real integration with a fake production success path.

For large operations such as emails, imports, exports, shortlist transitions, calendar creation and certificate generation, use background jobs with retries, idempotency and observable failure handling.

For concurrency-sensitive operations such as team capacity, interview slot reservation, rescheduling, payment webhooks, food coupon redemption and submissions at deadlines, use database constraints/transactions/locks/idempotency so correctness does not depend on the browser.

At the end of each development phase:
- run lint,
- run typecheck,
- run unit tests,
- run integration tests,
- run relevant E2E tests,
- review migrations,
- update implementation status,
- scan for unfinished required functionality.

Before finalizing the project, search the repository for:
`TODO`, `FIXME`, `mock`, `placeholder`, `coming soon`, `href="#"`, fake chart values and hard-coded sample states.

Resolve every instance that corresponds to a required production feature.

Do not reduce the scope without explicit instruction.

If a requirement creates an architectural issue, solve the architecture rather than silently dropping the requirement.

Build HealthHack as a reusable multi-event Event Operating System so HealthHack 2028 and later can be created through administration rather than by rewriting the application.

---

# 92. Source / Technology Notes

The stack decisions in this document intentionally favor stable, horizontally scalable, production-supported technologies.

At the time this specification was prepared:
- PostgreSQL 18 is a supported stable major release.
- PostgreSQL 19 is still in beta and should not be used for production.
- NestJS supports both conventional applications and microservice transports, allowing future service extraction if necessary.
- NestJS/BullMQ queues support persisted asynchronous jobs and multiple workers, useful for smoothing burst workloads.

Always re-check security advisories and supported versions immediately before production deployment instead of blindly pinning the versions that were current when this document was written.

---

# END OF SPECIFICATION
