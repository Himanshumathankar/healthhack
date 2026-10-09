import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@healthhack/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected a test response value.");
  return value;
}

type ResponseBody = {
  id?: string;
  message?: string;
  team?: { id: string; name: string; teamCode: string; joinCode: string };
  request?: { id: string };
};

describe.skipIf(process.env.RUN_TEAM_INTEGRATION !== "1")(
  "team workflow against local API",
  () => {
    const db = new PrismaClient();
    const tokens: string[] = [];
    const users: string[] = [];
    const suffix = randomBytes(6).toString("hex");
    let eventId: string;
    const api = process.env.INTEGRATION_API_URL ?? "http://localhost:4000";
    async function post(path: string, actor: number, body: unknown = {}) {
      const response = await fetch(`${api}/api/v1/teams${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens[actor] ?? ""}`,
        },
        body: JSON.stringify(body),
      });
      return {
        status: response.status,
        body: (await response.json()) as ResponseBody,
      };
    }
    beforeAll(async () => {
      const event = await db.event.create({
        data: {
          slug: `team-test-${suffix}`,
          name: "Team integration test",
          timezone: "Asia/Kolkata",
          settings: { create: [{ key: "team.maxSize", value: 3 }] },
        },
      });
      eventId = event.id;
      for (let index = 0; index < 8; index++) {
        const token = randomBytes(32).toString("base64url");
        const user = await db.user.create({
          data: {
            email: `team-test-${suffix}-${String(index)}@example.com`,
            passwordHash: "integration-test-only",
            emailVerifiedAt: new Date(),
            profile: {
              create: {
                fullName: "Integration Participant",
                skills: [],
                registrationCompletedAt: new Date(),
              },
            },
            sessions: {
              create: {
                tokenHash: createHash("sha256").update(token).digest("hex"),
                expiresAt: new Date(Date.now() + 300000),
              },
            },
          },
        });
        users.push(user.id);
        tokens.push(token);
      }
    });
    afterAll(async () => {
      if (eventId) await db.event.deleteMany({ where: { id: eventId } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.$disconnect();
    });

    it("creates unique teams, requests approval, enforces membership and protects leader actions", async () => {
      const created = await post("", 0, {
        eventId,
        name: `Team ALFA-${suffix}`,
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const team = required(created.body.team);
      expect(team.name).toBe(`ALFA-${suffix}`);
      expect(team.teamCode).toMatch(/^HH-VITB-JHU-\d{4}-\d{5,}$/);
      expect(team.joinCode).toMatch(/^\d{10}$/);
      expect(
        (await post("", 1, { eventId, name: `alfa-${suffix}` })).status,
      ).toBe(409);
      const second = await post("", 1, { eventId, name: `BETA-${suffix}` });
      expect(second.status).toBe(201);
      const other = required(second.body.team);
      expect(other.teamCode).not.toBe(team.teamCode);
      expect(other.joinCode).not.toBe(team.joinCode);
      expect(
        (await post("", 0, { eventId, name: `GAMMA-${suffix}` })).status,
      ).toBe(409);
      expect((await post("/join-requests", 2, { code: "123" })).status).toBe(
        400,
      );
      const request = await post("/join-requests", 2, { code: team.joinCode });
      expect(request.status).toBe(201);
      const requestId = required(request.body.request).id;
      expect(
        await db.teamMember.count({ where: { userId: required(users[2]) } }),
      ).toBe(0);
      expect(
        (await post("/join-requests", 2, { code: team.joinCode })).status,
      ).toBe(409);
      expect(
        (await post(`/join-requests/${requestId}/approve`, 1)).status,
      ).toBe(403);
      expect(
        (await post(`/join-requests/${requestId}/approve`, 0)).status,
      ).toBe(201);
      const readMine = async (actor: number) => {
        const response = await fetch(`${api}/api/v1/teams/mine`, {
          headers: { Authorization: `Bearer ${tokens[actor] ?? ""}` },
        });
        expect(response.status).toBe(200);
        return (await response.json()) as {
          membership: {
            role: string;
            team: {
              joinCode?: string;
              track: unknown;
              problemStatement: unknown;
            };
          };
          requests: unknown[];
        };
      };
      const leaderView = await readMine(0);
      const memberView = await readMine(2);
      expect(leaderView.membership.team.joinCode).toBe(team.joinCode);
      expect(memberView.membership.team.joinCode).toBeUndefined();
      expect(memberView.requests).toHaveLength(0);
      expect(memberView.membership.team.track).toBeNull();
      expect(memberView.membership.team.problemStatement).toBeNull();
      expect(
        (await post(`/join-requests/${requestId}/approve`, 0)).status,
      ).toBe(409);
      expect(
        (await post("/join-requests", 2, { code: other.joinCode })).status,
      ).toBe(409);
      expect((await post("/leave", 0)).status).toBe(400);
      expect(
        (await post(`/${team.id}/members/${required(users[0])}/remove`, 2))
          .status,
      ).toBe(403);
      expect(
        (await post(`/${team.id}/members/${required(users[2])}/remove`, 0))
          .status,
      ).toBe(201);
      expect(
        await db.teamMember.count({ where: { userId: required(users[2]) } }),
      ).toBe(0);
      const again = await post("/join-requests", 2, { code: team.joinCode });
      expect(
        (
          await post(
            `/join-requests/${required(again.body.request).id}/approve`,
            0,
          )
        ).status,
      ).toBe(201);
      expect((await post("/leave", 2)).status).toBe(201);
      const declined = await post("/join-requests", 3, { code: team.joinCode });
      expect(
        (
          await post(
            `/join-requests/${required(declined.body.request).id}/reject`,
            0,
          )
        ).status,
      ).toBe(201);
      expect(
        await db.teamMember.count({ where: { userId: required(users[3]) } }),
      ).toBe(0);
      const cancelled = await post("/join-requests", 4, {
        code: team.joinCode,
      });
      expect(
        (
          await post(
            `/join-requests/${required(cancelled.body.request).id}/cancel`,
            4,
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await post(
            `/join-requests/${required(cancelled.body.request).id}/approve`,
            0,
          )
        ).status,
      ).toBe(409);
      const firstRace = await post("/join-requests", 5, {
        code: team.joinCode,
      });
      const secondRace = await post("/join-requests", 5, {
        code: other.joinCode,
      });
      const results = await Promise.all([
        post(
          `/join-requests/${required(firstRace.body.request).id}/approve`,
          0,
        ),
        post(
          `/join-requests/${required(secondRace.body.request).id}/approve`,
          1,
        ),
      ]);
      expect(results.filter((result) => result.status === 201)).toHaveLength(1);
      expect(
        await db.teamMember.count({ where: { userId: required(users[5]) } }),
      ).toBe(1);
      await post("/leave", 5);
      const transfer = await post("/join-requests", 6, { code: team.joinCode });
      await post(
        `/join-requests/${required(transfer.body.request).id}/approve`,
        0,
      );
      expect(
        (await post(`/${team.id}/members/${required(users[6])}/leader`, 0))
          .status,
      ).toBe(201);
      expect(
        (await post(`/${team.id}/members/${required(users[6])}/remove`, 0))
          .status,
      ).toBe(403);
      expect((await post("/leave", 0)).status).toBe(201);
      expect((await post("/leave", 6)).status).toBe(201);
      expect(await db.team.findUnique({ where: { id: team.id } })).toBeNull();
    }, 30000);

    it("handles competing team names and capacity approvals safely", async () => {
      const names = await Promise.all([
        post("", 0, { eventId, name: `Race-${suffix}` }),
        post("", 2, { eventId, name: `TEAM race-${suffix}` }),
      ]);
      expect(names.map((result) => result.status).sort()).toEqual([201, 409]);
      const winner = names[0].status === 201 ? 0 : 2;
      const team = required(
        required(names.find((result) => result.status === 201)).body.team,
      );
      await db.eventSetting.update({
        where: { eventId_key: { eventId, key: "team.maxSize" } },
        data: { value: 2 },
      });
      const requests = await Promise.all([
        post("/join-requests", 3, { code: team.joinCode }),
        post("/join-requests", 4, { code: team.joinCode }),
      ]);
      expect(requests.map((result) => result.status)).toEqual([201, 201]);
      const approvals = await Promise.all(
        requests.map((result) =>
          post(
            `/join-requests/${required(result.body.request).id}/approve`,
            winner,
          ),
        ),
      );
      expect(approvals.map((result) => result.status).sort()).toEqual([
        201, 400,
      ]);
      expect(await db.teamMember.count({ where: { teamId: team.id } })).toBe(2);
      expect(
        (await post("/recruitment-settings", winner, { enabled: true })).status,
      ).toBe(201);
      const search = await fetch(`${api}/api/v1/teams/find?q=${suffix}`, {
        headers: { Authorization: `Bearer ${tokens[7] ?? ""}` },
      });
      const found = (await search.json()) as Array<{
        name: string;
        joinCode?: string;
      }>;
      expect(
        found.some((result) => result.name.toLowerCase() === `race-${suffix}`),
      ).toBe(true);
      expect(found.every((result) => result.joinCode === undefined)).toBe(true);
    }, 30000);
    it("requires discovery consent and protects recruitment invitations", async () => {
      async function get(
        path: string,
        actor: number,
      ): Promise<{ status: number; body: unknown }> {
        const response = await fetch(`${api}/api/v1/teams${path}`, {
          headers: { Authorization: `Bearer ${tokens[actor] ?? ""}` },
        });
        return {
          status: response.status,
          body: (await response.json()) as unknown,
        };
      }
      type Candidate = {
        id: string;
        email?: string;
        passwordHash?: string;
        profile: { skillExpertise: unknown; phone?: string };
      };
      type Discovery = { enabled: boolean; invitations: Array<{ id: string }> };
      async function discovery(actor: number) {
        const response = await get("/discovery", actor);
        return { ...response, body: response.body as Discovery };
      }
      async function teammates(actor: number) {
        const response = await get("/teammates", actor);
        return { ...response, body: response.body as Candidate[] };
      }
      expect((await discovery(5)).body.enabled).toBe(false);
      expect((await teammates(7)).status).toBe(403);
      expect((await post("/discovery", 5, { enabled: true })).status).toBe(400);
      expect(
        (await post(`/teammates/${required(users[5])}/invite`, 1)).status,
      ).toBe(404);
      await db.userProfile.update({
        where: { userId: required(users[5]) },
        data: {
          skills: ["Python"],
          skillExpertise: [{ name: "Python", expertise: "ADVANCED" }],
          phone: "private-test-value",
        },
      });
      expect(
        (await post("/discovery", 5, { enabled: true, consent: true })).status,
      ).toBe(201);
      const listed = (await teammates(1)).body;
      const candidate = required(
        listed.find((person) => person.id === users[5]),
      );
      expect(candidate.profile.skillExpertise).toEqual([
        { name: "Python", expertise: "ADVANCED" },
      ]);
      expect(candidate.email).toBeUndefined();
      expect(candidate.passwordHash).toBeUndefined();
      expect(candidate.profile.phone).toBeUndefined();
      const invite = await post(`/teammates/${required(users[5])}/invite`, 1);
      expect(invite.status).toBe(201);
      const invitationId = required(invite.body.id);
      expect(
        (await post(`/teammates/${required(users[5])}/invite`, 1)).status,
      ).toBe(409);
      expect(
        (await post(`/recruitment/${invitationId}/accept`, 6)).status,
      ).toBe(404);
      expect(
        (await discovery(5)).body.invitations.some(
          (item) => item.id === invitationId,
        ),
      ).toBe(true);
      expect((await post("/discovery", 5, { enabled: false })).status).toBe(
        201,
      );
      expect(
        (await teammates(1)).body.some((person) => person.id === users[5]),
      ).toBe(false);
      expect(
        (await post(`/recruitment/${invitationId}/accept`, 5)).status,
      ).toBe(409);
      await post("/discovery", 5, { enabled: true, consent: true });
      const declined = await post(`/teammates/${required(users[5])}/invite`, 1);
      expect(
        (await post(`/recruitment/${required(declined.body.id)}/decline`, 5))
          .status,
      ).toBe(201);
      expect(
        await db.teamMember.count({ where: { userId: required(users[5]) } }),
      ).toBe(0);
      const accepted = await post(`/teammates/${required(users[5])}/invite`, 1);
      expect(
        (await post(`/recruitment/${required(accepted.body.id)}/accept`, 5))
          .status,
      ).toBe(201);
      expect(
        await db.teamMember.count({ where: { userId: required(users[5]) } }),
      ).toBe(1);
      expect((await discovery(5)).body.enabled).toBe(false);
      expect(
        (await teammates(1)).body.some((person) => person.id === users[5]),
      ).toBe(false);
      expect(
        (await post("/discovery", 5, { enabled: true, consent: true })).status,
      ).toBe(409);
      await post("/leave", 5);

      const target = await db.teamMember.findUniqueOrThrow({
        where: { userId: required(users[1]) },
        include: { team: true },
      });
      const otherLeader = await db.teamMember.findFirstOrThrow({
        where: {
          role: "TEAM_LEADER",
          userId: { in: users.filter((id) => id !== required(users[1])) },
        },
      });
      await db.eventSetting.update({
        where: { eventId_key: { eventId, key: "team.maxSize" } },
        data: { value: 4 },
      });
      await post("/discovery", 7, { enabled: true, consent: true });
      const invitationA = await post(
        `/teammates/${required(users[7])}/invite`,
        1,
      );
      const otherActor = users.findIndex((id) => id === otherLeader.userId);
      const invitationB = await post(
        `/teammates/${required(users[7])}/invite`,
        otherActor,
      );
      expect(invitationA.status).toBe(201);
      expect(invitationB.status).toBe(201);
      const decisions = await Promise.all([
        post(`/recruitment/${required(invitationA.body.id)}/accept`, 7),
        post(`/recruitment/${required(invitationB.body.id)}/accept`, 7),
      ]);
      expect(
        decisions.filter((decision) => decision.status === 201),
      ).toHaveLength(1);
      expect(
        await db.teamMember.count({ where: { userId: required(users[7]) } }),
      ).toBe(1);
      const recruiting = await get("/recruiting", 6);
      const recruitingTeams = recruiting.body as Array<{
        id: string;
        members: number;
        capacity: number;
      }>;
      expect(
        recruitingTeams.every((team) => team.members < team.capacity),
      ).toBe(true);
      await post("/leave", 7);
      expect(
        (await post("/recruitment-settings", 1, { enabled: true })).status,
      ).toBe(201);
      const byTeam = await post("/join-requests", 6, { teamId: target.teamId });
      expect(byTeam.status).toBe(201);
      expect(
        await db.teamMember.count({ where: { userId: required(users[6]) } }),
      ).toBe(0);
    }, 30000);
    it("restricts profile previews and supports revoking sent invitations", async () => {
      async function get(path: string, actor: number) {
        const response = await fetch(`${api}/api/v1/teams${path}`, {
          headers: { Authorization: `Bearer ${tokens[actor] ?? ""}` },
        });
        return {
          status: response.status,
          body: (await response.json()) as unknown,
        };
      }
      const leader = await db.teamMember.findUniqueOrThrow({
        where: { userId: required(users[1]) },
      });
      expect(
        (await post("/recruitment-settings", 1, { enabled: false })).status,
      ).toBe(201);
      expect(
        (await post("/recruitment-settings", 7, { enabled: true })).status,
      ).toBe(403);
      const hidden = (await get("/recruiting", 7)).body as Array<{
        id: string;
      }>;
      expect(hidden.some((team) => team.id === leader.teamId)).toBe(false);
      expect((await get(`/${leader.teamId}/preview`, 7)).status).toBe(404);
      expect(
        (await post("/join-requests", 7, { teamId: leader.teamId })).status,
      ).toBe(404);
      await db.userProfile.update({
        where: { userId: required(users[1]) },
        data: {
          college: "Leader College",
          bio: "private leader biography",
          phone: "private-phone",
          city: "private-city",
          skillExpertise: [{ name: "Design", expertise: "EXPERT" }],
        },
      });
      expect(
        (await post("/recruitment-settings", 1, { enabled: true })).status,
      ).toBe(201);
      const visible = (await get("/recruiting", 7)).body as Array<{
        id: string;
      }>;
      expect(visible.some((team) => team.id === leader.teamId)).toBe(true);
      const preview = await get(`/${leader.teamId}/preview`, 7);
      expect(preview.status).toBe(200);
      const details = preview.body as {
        leader: Record<string, unknown>;
        members: unknown[];
      };
      expect(details.leader.college).toBe("Leader College");
      expect(details.leader.skillExpertise).toEqual([
        { name: "Design", expertise: "EXPERT" },
      ]);
      for (const key of [
        "phone",
        "email",
        "participantId",
        "city",
        "bio",
        "githubUrl",
      ])
        expect(details.leader[key]).toBeUndefined();
      expect(details.members.every((name) => typeof name === "string")).toBe(
        true,
      );

      await post("/discovery", 5, { enabled: true, consent: true });
      const candidate = await get(
        `/teammates/${required(users[5])}/profile`,
        1,
      );
      expect(candidate.status).toBe(200);
      const candidateData = candidate.body as {
        profile: Record<string, unknown>;
        email?: string;
      };
      expect(candidateData.profile.phone).toBeUndefined();
      expect(candidateData.email).toBeUndefined();
      expect(
        (await get(`/teammates/${required(users[5])}/profile`, 7)).status,
      ).toBe(403);
      const invitation = await post(
        `/teammates/${required(users[5])}/invite`,
        1,
      );
      expect(invitation.status).toBe(201);
      const invitationId = required(invitation.body.id);
      const sent = await get("/recruitment/sent", 1);
      expect(
        (sent.body as Array<{ id: string }>).some(
          (item) => item.id === invitationId,
        ),
      ).toBe(true);
      expect((await get("/recruitment/sent", 7)).status).toBe(403);
      expect(
        (await post(`/recruitment/${invitationId}/revoke`, 7)).status,
      ).toBe(403);
      expect(
        (await post(`/recruitment/${invitationId}/revoke`, 1)).status,
      ).toBe(201);
      expect(
        (await post(`/recruitment/${invitationId}/accept`, 5)).status,
      ).toBe(409);
      expect(
        (await post(`/recruitment/${invitationId}/revoke`, 1)).status,
      ).toBe(409);
      await post("/discovery", 5, { enabled: false });
      expect(
        (await get(`/teammates/${required(users[5])}/profile`, 1)).status,
      ).toBe(404);

      const sentJoin = await post("/join-requests", 7, {
        teamId: leader.teamId,
      });
      expect(sentJoin.status).toBe(201);
      const joinId = required(sentJoin.body.request).id;
      const outbox = (await get("/discovery", 7)).body as {
        sentRequests: Array<{ id: string }>;
      };
      expect(outbox.sentRequests.some((request) => request.id === joinId)).toBe(
        true,
      );
      expect((await post(`/join-requests/${joinId}/cancel`, 5)).status).toBe(
        404,
      );
      expect((await post(`/join-requests/${joinId}/cancel`, 7)).status).toBe(
        201,
      );
      expect((await post(`/join-requests/${joinId}/approve`, 1)).status).toBe(
        409,
      );
      const history = (await get("/discovery", 7)).body as {
        sentRequests: Array<{ id: string; status: string }>;
      };
      expect(
        history.sentRequests.find((request) => request.id === joinId)?.status,
      ).toBe("CANCELLED");
    }, 30000);
  },
);
