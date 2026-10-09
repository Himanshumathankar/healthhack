import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { PrismaClient } from "@healthhack/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { organizationPermissions } from "@healthhack/contracts";

type Result = {
  request?: { id: string };
  id?: string;
  message?: string;
  sessionToken?: string;
  user?: { organizationAccess: boolean };
};
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected a test value.");
  return value;
}
describe.skipIf(process.env.RUN_ADMIN_INTEGRATION !== "1")(
  "organization administration against local API",
  () => {
    const db = new PrismaClient();
    const api = process.env.INTEGRATION_API_URL ?? "http://localhost:4000";
    const suffix = randomBytes(5).toString("hex");
    const users: string[] = [];
    const tokens: string[] = [];
    const emails: string[] = [];
    const customRoles: string[] = [];
    const announcements: string[] = [];
    const services: string[] = [];
    const tickets: string[] = [];
    const events: string[] = [];
    const administrativeTeams: string[] = [];
    const password = "Test!Admin2027";
    async function request(path: string, actor: number, body?: unknown) {
      const response = await fetch(`${api}/api/v1/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens[actor] ?? ""}`,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        body: (await response.json()) as Result,
      };
    }
    async function raw(path: string, actor: number) {
      const response = await fetch(`${api}/api/v1/${path}`, {
        headers: { Authorization: `Bearer ${tokens[actor] ?? ""}` },
      });
      return {
        status: response.status,
        body: (await response.json()) as unknown,
      };
    }
    beforeAll(async () => {
      const superRole = await db.organizationRole.findUniqueOrThrow({
        where: { builtInKey: "SUPER_ADMIN" },
      });
      const reviewer = await db.organizationRole.findUniqueOrThrow({
        where: { builtInKey: "REVIEWER" },
      });
      const hash = await argon2.hash(password);
      for (let index = 0; index < 6; index++) {
        const token = randomBytes(32).toString("base64url");
        const email = `org-test-${suffix}-${String(index)}@example.com`;
        const user = await db.user.create({
          data: {
            email,
            username: `org_${suffix}_${String(index)}`,
            passwordHash: hash,
            emailVerifiedAt: new Date(),
            ...(index === 0
              ? { globalRole: "SUPER_ADMIN", organizationRoleId: superRole.id }
              : index === 2
                ? { organizationRoleId: reviewer.id }
                : {}),
            profile: {
              create: {
                fullName: "Admin integration participant",
                skills: [],
                registrationCompletedAt: new Date(),
              },
            },
            sessions: {
              create: {
                tokenHash: createHash("sha256").update(token).digest("hex"),
                expiresAt: new Date(Date.now() + 600000),
              },
            },
          },
        });
        users.push(user.id);
        tokens.push(token);
        emails.push(email);
      }
    });
    afterAll(async () => {
      await db.announcement.deleteMany({
        where: { id: { in: announcements } },
      });
      await db.organizationService.deleteMany({
        where: { id: { in: services } },
      });
      await db.supportTicket.deleteMany({ where: { id: { in: tickets } } });
      await db.team.deleteMany({ where: { id: { in: administrativeTeams } } });
      await db.event.deleteMany({ where: { id: { in: events } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.organizationRole.deleteMany({
        where: { id: { in: customRoles } },
      });
      await db.$disconnect();
    });

    it("blocks participants, preserves built-in roles, and requires a super-admin password for assignments", async () => {
      expect((await request("admin/me", 1)).status).toBe(403);
      expect((await request("admin/users", 1)).status).toBe(403);
      expect((await request("admin/users", 2)).status).toBe(403);
      const rolesResult = await raw("admin/roles", 0);
      const roles = rolesResult.body as Array<{
        id: string;
        builtInKey: string | null;
        permissions: string[];
      }>;
      expect(roles.filter((role) => role.builtInKey)).toHaveLength(7);
      const superRole = required(
        roles.find((role) => role.builtInKey === "SUPER_ADMIN"),
      );
      expect(superRole.permissions).toHaveLength(
        organizationPermissions.length,
      );
      expect(
        (await request(`admin/roles/${superRole.id}/delete`, 0, {})).status,
      ).toBe(400);
      expect(
        (
          await request(`admin/roles/${superRole.id}/permissions`, 0, {
            permissions: [],
            password,
          })
        ).status,
      ).toBe(400);
      const created = await request("admin/roles", 0, {
        name: `Custom-${suffix}`,
        description: "Test role",
      });
      expect(created.status).toBe(201);
      const roleId = required(created.body.id);
      customRoles.push(roleId);
      expect(
        (
          await request("admin/roles", 0, {
            name: `custom-${suffix}`,
            description: "Duplicate",
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(`admin/users/${required(users[1])}/role`, 0, {
            roleId,
            password: "wrong",
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await request(`admin/users/${required(users[1])}/role`, 0, {
            roleId,
            password,
          })
        ).status,
      ).toBe(201);
      expect((await request("identity/me", 1)).status).toBe(401);
      const login = await request("identity/login", 1, {
        identifier: `org_${suffix}_1`,
        password,
      });
      expect(login.status).toBe(201);
      tokens[1] = required(login.body.sessionToken);
      expect(login.body.user?.organizationAccess).toBe(true);
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: required(users[1]) } }))
          .lastSignInAt,
      ).not.toBeNull();
      expect(
        (await request(`admin/roles/${roleId}/delete`, 0, {})).status,
      ).toBe(409);
      expect(
        (
          await request(`admin/roles/${roleId}/permissions`, 0, {
            password,
            permissions: ["org.dashboard.read", "org.users.read"],
          })
        ).status,
      ).toBe(201);
      expect((await request("admin/users", 1)).status).toBe(200);
      expect(
        (
          await request(`admin/users/${required(users[3])}/role`, 1, {
            roleId: superRole.id,
            password,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(`admin/roles/${roleId}/permissions`, 1, {
            password,
            permissions: organizationPermissions.map((entry) => entry.key),
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(`admin/roles/${roleId}/permissions`, 0, {
            password,
            permissions: ["org.fake.escalation"],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await request(`admin/users/${required(users[0])}/role`, 0, {
            roleId: null,
            password,
          })
        ).status,
      ).toBe(400);
    });

    it("enforces suspension/deletion, session revocation, and a usable password reset flow", async () => {
      expect(
        (
          await request(`admin/users/${required(users[3])}/action`, 0, {
            action: "suspend",
            password: "wrong",
            reason: "Integration test",
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await request(`admin/users/${required(users[3])}/action`, 0, {
            action: "suspend",
            password,
            reason: "Integration test",
          })
        ).status,
      ).toBe(201);
      expect((await request("identity/me", 3)).status).toBe(401);
      expect(
        (
          await request("identity/login", 3, {
            email: required(emails[3]),
            password,
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await request(`admin/users/${required(users[3])}/action`, 0, {
            action: "restore",
            password,
            reason: "Integration test finished",
          })
        ).status,
      ).toBe(201);
      const login = await request("identity/login", 3, {
        email: required(emails[3]),
        password,
      });
      expect(login.status).toBe(201);
      tokens[3] = required(login.body.sessionToken);
      expect(
        (
          await request(`admin/users/${required(users[3])}/action`, 0, {
            action: "reset-password",
            password,
            reason: "Integration reset",
          })
        ).status,
      ).toBe(201);
      const email = await db.emailMessage.findFirstOrThrow({
        where: {
          recipientUserId: required(users[3]),
          templateKey: "identity.password_reset",
        },
        orderBy: { createdAt: "desc" },
      });
      const token = required(
        email.textBody.match(/token=([A-Za-z0-9_-]+)/)?.[1],
      );
      const newPassword = "New!Strong2027";
      const reset = await request("identity/reset-password", 3, {
        token,
        password: newPassword,
        confirmPassword: newPassword,
      });
      expect(reset.status).toBe(201);
      expect((await request("identity/me", 3)).status).toBe(401);
      expect(
        (
          await request("identity/reset-password", 3, {
            token,
            password: newPassword,
            confirmPassword: newPassword,
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await request("identity/login", 3, {
            email: required(emails[3]),
            password: newPassword,
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await request(`admin/users/${required(users[4])}/action`, 0, {
            action: "delete",
            password,
            reason: "Delete test account",
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await request("identity/login", 4, {
            email: required(emails[4]),
            password,
          })
        ).status,
      ).toBe(401);
      const userPage = (await raw(`admin/users?q=${suffix}`, 0)).body as {
        items: Array<{ id: string; passwordHash?: string }>;
      };
      expect(userPage.items.some((user) => user.id === users[4])).toBe(false);
      expect(
        userPage.items.every((user) => user.passwordHash === undefined),
      ).toBe(true);
      const session = await db.userSession.findFirstOrThrow({
        where: { userId: required(users[5]), revokedAt: null },
      });
      expect(
        (await request(`admin/sessions/${session.id}/revoke`, 0, {})).status,
      ).toBe(201);
      expect((await request("identity/me", 5)).status).toBe(401);
    });

    it("makes announcements/services/support usable and rejects unauthorized publication and review scoring", async () => {
      const draft = await request("admin/announcements", 0, {
        title: `Announcement-${suffix}`,
        body: "Private draft announcement",
        published: false,
      });
      expect(draft.status).toBe(201);
      const id = required(draft.body.id);
      announcements.push(id);
      const publicBefore = (await raw("announcements", 3)).body as Array<{
        id: string;
      }>;
      // The reset test invalidated actor 3's old token; use the still-active participant token.
      expect((await raw("announcements", 3)).status).toBe(401);
      expect(Array.isArray(publicBefore)).toBe(false);
      const participantLogin = await request("identity/login", 3, {
        email: required(emails[3]),
        password: "New!Strong2027",
      });
      tokens[3] = required(participantLogin.body.sessionToken);
      expect(
        ((await raw("announcements", 3)).body as Array<{ id: string }>).some(
          (item) => item.id === id,
        ),
      ).toBe(false);
      expect(
        (
          await request(`admin/announcements/${id}`, 0, {
            title: `Announcement-${suffix}`,
            body: "Published announcement",
            published: true,
          })
        ).status,
      ).toBe(201);
      expect(
        ((await raw("announcements", 3)).body as Array<{ id: string }>).some(
          (item) => item.id === id,
        ),
      ).toBe(true);
      const role = required(customRoles[0]);
      await request(`admin/roles/${role}/permissions`, 0, {
        password,
        permissions: [
          "org.dashboard.read",
          "org.announcements.read",
          "org.announcements.update",
        ],
      });
      expect(
        (
          await request(`admin/announcements/${id}`, 1, {
            title: "Permission bypass attempt",
            body: "Attempt to unpublish without permission",
            published: false,
          })
        ).status,
      ).toBe(403);
      const service = await request("admin/services", 0, {
        name: `Service-${suffix}`,
        description: "Local test service",
        active: true,
      });
      expect(service.status).toBe(201);
      services.push(required(service.body.id));
      const ticket = await request("admin/support", 0, {
        subject: `Support-${suffix}`,
        message: "Integration ticket",
        status: "OPEN",
        assignedTo: null,
      });
      expect(ticket.status).toBe(201);
      tickets.push(required(ticket.body.id));
      const event = await db.event.create({
        data: {
          slug: `org-test-${suffix}`,
          name: "Admin test event",
          timezone: "Asia/Kolkata",
        },
      });
      events.push(event.id);
      const team = await db.team.create({
        data: { eventId: event.id, name: `Review-${suffix}` },
      });
      const submission = await db.submission.create({
        data: {
          teamId: team.id,
          title: "Integration submission",
          summary: "Test review workflow",
        },
      });
      expect(
        (
          await request(`admin/submissions/${submission.id}/review`, 2, {
            score: 90,
            feedback: "Reviewer test",
            published: true,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(`admin/submissions/${submission.id}/review`, 2, {
            score: 90,
            feedback: "Reviewer test",
            published: false,
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await request(`admin/submissions/${submission.id}/review`, 2, {
            score: 120,
            feedback: "Invalid score",
            published: false,
          })
        ).status,
      ).toBe(400);
      await db.teamMember.createMany({
        data: [
          { teamId: team.id, userId: required(users[3]), role: "TEAM_LEADER" },
          { teamId: team.id, userId: required(users[5]), role: "TEAM_MEMBER" },
        ],
      });
      expect(
        (
          await request(
            `admin/teams/${team.id}/members/${required(users[5])}`,
            1,
            { action: "remove" },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `admin/teams/${team.id}/members/${required(users[3])}`,
            0,
            { action: "remove" },
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await request(
            `admin/teams/${team.id}/members/${required(users[5])}`,
            0,
            { action: "leader" },
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await request(
            `admin/teams/${team.id}/members/${required(users[3])}`,
            0,
            { action: "remove" },
          )
        ).status,
      ).toBe(201);
      const logs = await db.auditLog.findMany({
        where: {
          actorUserId: required(users[0]),
          action: { startsWith: "org." },
        },
      });
      expect(logs.length).toBeGreaterThan(5);
      expect(JSON.stringify(logs)).not.toContain(password);
    });
    it("lets authorized admins create teams and manage pending membership activity", async () => {
      const leader = await db.user.findUniqueOrThrow({
        where: { id: required(users[3]) },
      });
      const body = {
        name: `Team Managed-${suffix}`,
        leaderParticipantId: leader.participantId,
        description: "Administrative test team",
        requiresMembers: false,
      };
      expect((await request("admin/teams", 2, body)).status).toBe(403);
      const created = await request("admin/teams", 0, body);
      expect(created.status).toBe(201);
      const teamId = required(created.body.id);
      administrativeTeams.push(teamId);
      const team = await db.team.findUniqueOrThrow({ where: { id: teamId } });
      expect(team.name).toBe(`Managed-${suffix}`);
      expect(team.teamCode).toMatch(/^HH-VITB-JHU-\d{4}-\d{5,}$/);
      expect(
        (
          await request("admin/teams", 0, {
            ...body,
            name: `Duplicate-${suffix}`,
          })
        ).status,
      ).toBe(409);
      const pending = await request("teams/join-requests", 1, {
        code: team.joinCode,
      });
      expect(pending.status).toBe(201);
      const pendingRecordId = required(pending.body.request).id;
      expect(
        (
          await request(
            `admin/teams/${teamId}/invitations/${pendingRecordId}/revoke`,
            2,
            { kind: "request" },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `admin/teams/${teamId}/invitations/${pendingRecordId}/revoke`,
            0,
            { kind: "request" },
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await db.teamJoinRequest.findUniqueOrThrow({
            where: { id: pendingRecordId },
          })
        ).status,
      ).toBe("CANCELLED");
      expect(
        (await request("teams/discovery", 2, { enabled: true, consent: true }))
          .status,
      ).toBe(201);
      const invited = await request(
        `teams/teammates/${required(users[2])}/invite`,
        3,
        {},
      );
      expect(invited.status).toBe(201);
      const invitationId = required(invited.body.id);
      expect(
        (await request(`admin/teams/${teamId}/invitations`, 0)).status,
      ).toBe(200);
      expect(
        (
          await request(
            `admin/teams/${teamId}/invitations/${invitationId}/revoke`,
            0,
            { kind: "invitation" },
          )
        ).status,
      ).toBe(201);
      expect(
        (await request(`teams/recruitment/${invitationId}/accept`, 2, {}))
          .status,
      ).toBe(409);
      expect(
        (await request(`admin/teams/${teamId}/delete`, 0, {})).status,
      ).toBe(201);
      expect(await db.team.findUnique({ where: { id: teamId } })).toBeNull();
    });
    it("serializes concurrent super-admin role changes and rechecks the acting role", async () => {
      const role = await db.organizationRole.findUniqueOrThrow({
        where: { builtInKey: "SUPER_ADMIN" },
      });
      const passwordHash = await argon2.hash(password);
      const actors: number[] = [];
      for (let index = 0; index < 2; index++) {
        const token = randomBytes(32).toString("base64url");
        const email = `org-race-${suffix}-${String(index)}@example.com`;
        const account = await db.user.create({
          data: {
            email,
            passwordHash,
            emailVerifiedAt: new Date(),
            globalRole: "SUPER_ADMIN",
            organizationRoleId: role.id,
            profile: { create: { fullName: "Race Admin", skills: [] } },
            sessions: {
              create: {
                tokenHash: createHash("sha256").update(token).digest("hex"),
                expiresAt: new Date(Date.now() + 600000),
              },
            },
          },
        });
        actors.push(users.length);
        users.push(account.id);
        tokens.push(token);
        emails.push(email);
      }
      const first = required(actors[0]);
      const second = required(actors[1]);
      const changes = await Promise.all([
        request(`admin/users/${required(users[second])}/role`, first, {
          roleId: null,
          password,
        }),
        request(`admin/users/${required(users[first])}/role`, second, {
          roleId: null,
          password,
        }),
      ]);
      expect(changes.filter((change) => change.status === 201)).toHaveLength(1);
      expect(
        changes.filter((change) => [401, 403].includes(change.status)),
      ).toHaveLength(1);
      expect(
        await db.user.count({
          where: {
            id: { in: [required(users[first]), required(users[second])] },
            globalRole: "SUPER_ADMIN",
          },
        }),
      ).toBe(1);
    });
  },
);
