# Organization Administration

The organization workspace is `/admin`. Participant and team-leader access remains separate from organization roles.

## Development Account

After migrations and API startup, run `pnpm admin:bootstrap:dev`. This creates the explicitly requested local-development account `adminstratore` with password `adminstratore`. An existing account is never overwritten, and the script refuses production execution.

## Role Model

Built-in roles are Super admin, Coordinators, Faculty, Reviewer, Volunteers, Support team, and Guest. Custom roles start without permissions. Participants retain participant access unless explicitly assigned an organization role.

Only a super admin can assign organization roles or change permission grants, and these actions require their current password. Built-in roles cannot be deleted or renamed. Super admin grants cannot be reduced. Sensitive user actions require password confirmation and an audit reason. Account deletion deactivates the account and preserves audit history; it does not erase historical records.

## Adding Features

1. Add module/action entries to `organizationModules` in `packages/contracts/src/index.ts`.
2. Protect every admin endpoint with `SessionGuard`, `AdminGuard`, and `@OrgPermission("org.module.operation")`.
3. The API synchronizes the permission registry at startup. The role matrix and permission catalog derive from the same registry and automatically include the new operation.
4. New grants default to denied. Keep participant/ownership-based permissions separate from organization administration.
5. Add tests showing both authorized access and forbidden access. The guard rejects unregistered permission keys.

Run the optional local admin integration suite with the project environment loaded and `RUN_ADMIN_INTEGRATION=1 pnpm --filter @healthhack/api exec vitest run src/modules/admin/admin.integration.test.ts`.

## Workspace Tabs

Users & roles contains All users, Role manager, Permission catalog, Sessions, and Audit log. Each tab and every backend operation checks its own permission. Roles can be inspected by authorized readers; only super admins can save grants.

Submissions and reviews have persistent administrative records and score/publish permissions. Participant submission creation is a separate workflow. Announcements published in the admin workspace appear in the participant announcement feed. Password reset requests queue a one-hour, single-use email link; completion revokes all sessions.
