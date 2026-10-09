import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type OnModuleInit,
} from "@nestjs/common";
import argon2 from "argon2";
import { z } from "zod";
import {
  adminRoleSchema,
  adminRolePermissionsSchema,
  adminUserRoleSchema,
  adminUserActionSchema,
  adminTeamUpdateSchema,
  adminTeamCreateSchema,
  announcementSchema,
  builtInOrganizationRoles,
  organizationPermissions,
} from "@healthhack/contracts";
import type { Prisma } from "@healthhack/database";
import { PrismaService } from "../prisma/prisma.service.js";
import { EmailQueueService } from "../email/email-queue.service.js";
import { generateOpaqueToken, hashToken } from "../common/tokens.js";
import type { RequestContext } from "../common/request-context.js";
import { buildPasswordResetMessage } from "@healthhack/email";

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  async onModuleInit() {
    for (const permission of organizationPermissions)
      await this.prisma.permission.upsert({
        where: { key: permission.key },
        update: { description: `${permission.module}: ${permission.action}` },
        create: {
          key: permission.key,
          description: `${permission.module}: ${permission.action}`,
        },
      });
    for (const definition of builtInOrganizationRoles) {
      const role = await this.prisma.organizationRole.upsert({
        where: { builtInKey: definition.key },
        update: {},
        create: { name: definition.name, builtInKey: definition.key },
      });
      if (!role.initialized) {
        const grants = await this.prisma.permission.findMany({
          where: { key: { in: definition.grants } },
          select: { id: true },
        });
        await this.prisma.$transaction(async (tx) => {
          await tx.organizationRolePermission.createMany({
            data: grants.map((permission) => ({
              roleId: role.id,
              permissionId: permission.id,
            })),
            skipDuplicates: true,
          });
          await tx.organizationRole.update({
            where: { id: role.id },
            data: { initialized: true },
          });
        });
      }
    }
  }

  async access(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { select: { fullName: true } },
        organizationRole: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });
    if (!user || user.suspendedAt || user.deletedAt)
      throw new UnauthorizedException("This account is not active.");
    if (!user.globalRole && !user.organizationRole)
      throw new ForbiddenException(
        "Organization access has not been assigned to your account.",
      );
    const superAdmin = user.globalRole === "SUPER_ADMIN";
    return {
      id: user.id,
      name: user.profile?.fullName ?? user.email,
      username: user.username,
      email: user.email,
      role: superAdmin ? "Super admin" : (user.organizationRole?.name ?? ""),
      superAdmin,
      permissions: superAdmin
        ? organizationPermissions.map((permission) => permission.key)
        : (
            user.organizationRole?.permissions.map(
              (grant) => grant.permission.key,
            ) ?? []
          ).filter((key) =>
            organizationPermissions.some(
              (permission) =>
                permission.key === key && !permission.superAdminOnly,
            ),
          ),
    };
  }

  async authorize(userId: string, permission: string) {
    if (!organizationPermissions.some((entry) => entry.key === permission))
      throw new ForbiddenException("Unregistered permission.");
    const access = await this.access(userId);
    if (!access.permissions.includes(permission))
      throw new ForbiddenException(
        "You do not have permission for this action.",
      );
    return access;
  }

  async overview() {
    const [
      users,
      teams,
      suspended,
      verified,
      pendingRequests,
      announcements,
      tickets,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.team.count(),
      this.prisma.user.count({
        where: { suspendedAt: { not: null }, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { emailVerifiedAt: { not: null }, deletedAt: null },
      }),
      this.prisma.teamJoinRequest.count({ where: { status: "PENDING" } }),
      this.prisma.announcement.count({ where: { published: true } }),
      this.prisma.supportTicket.count({
        where: { status: { not: "RESOLVED" } },
      }),
    ]);
    return {
      users,
      teams,
      suspended,
      verified,
      pendingRequests,
      announcements,
      tickets,
    };
  }

  async users(query: string, page: number) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      OR: [
        { email: { contains: query.trim(), mode: "insensitive" } },
        { username: { contains: query.trim(), mode: "insensitive" } },
        {
          profile: {
            is: { fullName: { contains: query.trim(), mode: "insensitive" } },
          },
        },
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * 25,
        take: 25,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          participantId: true,
          email: true,
          username: true,
          globalRole: true,
          organizationRoleId: true,
          organizationRole: { select: { name: true } },
          suspendedAt: true,
          lastSignInAt: true,
          emailVerifiedAt: true,
          profile: { select: { fullName: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize: 25 };
  }

  async roles() {
    const roles = await this.prisma.organizationRole.findMany({
      orderBy: [{ builtInKey: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { users: true } },
        permissions: { include: { permission: { select: { key: true } } } },
      },
    });
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      builtInKey: role.builtInKey,
      users: role._count.users,
      permissions:
        role.builtInKey === "SUPER_ADMIN"
          ? organizationPermissions.map((entry) => entry.key)
          : role.permissions
              .map((grant) => grant.permission.key)
              .filter((key) =>
                organizationPermissions.some(
                  (permission) =>
                    permission.key === key && !permission.superAdminOnly,
                ),
              ),
    }));
  }

  async saveRole(
    actorId: string,
    roleId: string | null,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(adminRoleSchema, body);
    return this.mutate(async (tx) => {
      if (roleId) {
        const existing = await tx.organizationRole.findUnique({
          where: { id: roleId },
        });
        if (!existing) throw new NotFoundException("Role not found.");
        if (existing.builtInKey)
          throw new BadRequestException(
            "Built-in role names cannot be changed.",
          );
      }
      const role = roleId
        ? await tx.organizationRole.update({
            where: { id: roleId },
            data: input,
          })
        : await tx.organizationRole.create({
            data: { ...input, initialized: true },
          });
      await this.audit(
        tx,
        actorId,
        roleId ? "org.role.update" : "org.role.create",
        "OrganizationRole",
        role.id,
        { name: role.name },
        context,
      );
      return role;
    });
  }

  async deleteRole(actorId: string, roleId: string, context: RequestContext) {
    return this.mutate(async (tx) => {
      const role = await tx.organizationRole.findUnique({
        where: { id: roleId },
        include: { _count: { select: { users: true } } },
      });
      if (!role) throw new NotFoundException("Role not found.");
      if (role.builtInKey)
        throw new BadRequestException("Built-in roles cannot be deleted.");
      if (role._count.users)
        throw new ConflictException(
          "Reassign users before deleting this role.",
        );
      await tx.organizationRole.delete({ where: { id: roleId } });
      await this.audit(
        tx,
        actorId,
        "org.role.delete",
        "OrganizationRole",
        roleId,
        { name: role.name },
        context,
      );
      return { deleted: true };
    });
  }

  async updatePermissions(
    actorId: string,
    roleId: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(adminRolePermissionsSchema, body);
    await this.confirmSuperAdmin(actorId, input.password);
    if (
      input.permissions.some(
        (key) => !organizationPermissions.some((entry) => entry.key === key),
      )
    )
      throw new BadRequestException("Unknown permission selected.");
    if (
      input.permissions.some((key) =>
        organizationPermissions.some(
          (permission) => permission.key === key && permission.superAdminOnly,
        ),
      )
    )
      throw new BadRequestException(
        "Role assignments and permission grants are reserved for super admins.",
      );
    return this.mutate(async (tx) => {
      await this.lockAdministration(tx);
      await this.requireActiveSuperAdmin(tx, actorId);
      const role = await tx.organizationRole.findUnique({
        where: { id: roleId },
      });
      if (!role) throw new NotFoundException("Role not found.");
      if (role.builtInKey === "SUPER_ADMIN")
        throw new BadRequestException(
          "Super admin always has all permissions.",
        );
      const permissions = await tx.permission.findMany({
        where: { key: { in: input.permissions } },
        select: { id: true },
      });
      await tx.organizationRolePermission.deleteMany({ where: { roleId } });
      await tx.organizationRolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
      await this.audit(
        tx,
        actorId,
        "org.role.permissions",
        "OrganizationRole",
        roleId,
        { permissions: input.permissions },
        context,
      );
      return { saved: true };
    });
  }

  async changeRole(
    actorId: string,
    targetId: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(adminUserRoleSchema, body);
    await this.confirmSuperAdmin(actorId, input.password);
    return this.mutate(async (tx) => {
      await this.lockAdministration(tx);
      await this.requireActiveSuperAdmin(tx, actorId);
      const target = await tx.user.findUnique({ where: { id: targetId } });
      if (!target || target.deletedAt)
        throw new NotFoundException("User not found.");
      if (targetId === actorId)
        throw new BadRequestException(
          "Your own role cannot be changed from this action.",
        );
      const role = input.roleId
        ? await tx.organizationRole.findUnique({ where: { id: input.roleId } })
        : null;
      if (input.roleId && !role) throw new NotFoundException("Role not found.");
      if (
        target.globalRole === "SUPER_ADMIN" &&
        !target.suspendedAt &&
        role?.builtInKey !== "SUPER_ADMIN"
      )
        await this.protectLastSuperAdmin(tx);
      await tx.user.update({
        where: { id: targetId },
        data: {
          organizationRoleId: role?.id ?? null,
          globalRole: role?.builtInKey === "SUPER_ADMIN" ? "SUPER_ADMIN" : null,
        },
      });
      await tx.userSession.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit(
        tx,
        actorId,
        "org.user.role",
        "User",
        targetId,
        {
          role: role?.name ?? "Participant",
          previousGlobalRole: target.globalRole,
        },
        context,
      );
      return { changed: true };
    });
  }

  async userAction(
    actorId: string,
    targetId: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(adminUserActionSchema, body);
    const permission =
      input.action === "reset-password"
        ? "org.users.password.reset"
        : input.action === "delete"
          ? "org.users.delete"
          : "org.users.suspend";
    await this.authorize(actorId, permission);
    await this.confirmPassword(actorId, input.password);
    if (targetId === actorId && input.action !== "reset-password")
      throw new BadRequestException(
        "You cannot suspend, restore, or delete your own account.",
      );
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target || target.deletedAt)
      throw new NotFoundException("User not found.");
    if (target.globalRole === "SUPER_ADMIN")
      await this.confirmSuperAdmin(actorId, input.password);
    if (input.action === "reset-password") {
      const token = generateOpaqueToken();
      await this.mutate(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${targetId}::uuid FOR UPDATE`;
        await tx.passwordReset.updateMany({
          where: { userId: targetId, usedAt: null },
          data: { usedAt: new Date() },
        });
        await tx.passwordReset.create({
          data: {
            userId: targetId,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
        await this.audit(
          tx,
          actorId,
          "org.user.password_reset",
          "User",
          targetId,
          { reason: input.reason },
          context,
        );
      });
      await this.emailQueue.queueEmail({
        recipientUserId: targetId,
        ...buildPasswordResetMessage({
          appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
          email: target.email,
          token,
        }),
      });
      return { message: "Password reset email queued." };
    }
    return this.mutate(async (tx) => {
      await this.lockAdministration(tx);
      const current = await tx.user.findUniqueOrThrow({
        where: { id: targetId },
      });
      if (
        current.globalRole === "SUPER_ADMIN" &&
        !current.suspendedAt &&
        input.action !== "restore"
      )
        await this.protectLastSuperAdmin(tx);
      if (input.action === "delete") {
        const membership = await tx.teamMember.findUnique({
          where: { userId: targetId },
        });
        if (membership?.role === "TEAM_LEADER") {
          if (
            (await tx.teamMember.count({
              where: { teamId: membership.teamId },
            })) > 1
          )
            throw new BadRequestException(
              "Transfer team leadership before deleting this user.",
            );
          await tx.team.delete({ where: { id: membership.teamId } });
        } else if (membership)
          await tx.teamMember.delete({ where: { userId: targetId } });
      }
      await tx.user.update({
        where: { id: targetId },
        data:
          input.action === "delete"
            ? {
                deletedAt: new Date(),
                wantsToJoinTeam: false,
                organizationRoleId: null,
                globalRole: null,
              }
            : {
                suspendedAt: input.action === "suspend" ? new Date() : null,
                ...(input.action === "suspend"
                  ? { wantsToJoinTeam: false }
                  : {}),
              },
      });
      if (input.action !== "restore") {
        await tx.userSession.updateMany({
          where: { userId: targetId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.teamJoinRequest.updateMany({
          where: { userId: targetId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
        await tx.teamRecruitmentInvitation.updateMany({
          where: { userId: targetId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      }
      await this.audit(
        tx,
        actorId,
        `org.user.${input.action}`,
        "User",
        targetId,
        { reason: input.reason },
        context,
      );
      return { changed: true };
    });
  }

  async sessions() {
    return this.prisma.userSession.findMany({
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
        user: { deletedAt: null },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        userAgent: true,
        ipAddress: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true } },
          },
        },
      },
    });
  }
  async revokeSession(
    actorId: string,
    sessionId: string,
    context: RequestContext,
  ) {
    return this.mutate(async (tx) => {
      const result = await tx.userSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!result.count)
        throw new NotFoundException("Active session not found.");
      await this.audit(
        tx,
        actorId,
        "org.session.revoke",
        "UserSession",
        sessionId,
        {},
        context,
      );
      return { revoked: true };
    });
  }
  async auditLog() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        after: true,
        actor: {
          select: { email: true, profile: { select: { fullName: true } } },
        },
      },
    });
  }
  async teams() {
    return this.prisma.team.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        teamCode: true,
        description: true,
        status: true,
        requiresMembers: true,
        _count: { select: { members: true } },
        members: {
          where: { role: "TEAM_LEADER" },
          select: {
            user: {
              select: { profile: { select: { fullName: true } } },
            },
          },
        },
      },
    });
  }
  async createTeam(actorId: string, body: unknown, context: RequestContext) {
    const input = this.parse(adminTeamCreateSchema, body);
    const leader = await this.prisma.user.findUnique({
      where: { participantId: input.leaderParticipantId },
      include: { profile: true },
    });
    if (
      !leader ||
      leader.suspendedAt ||
      leader.deletedAt ||
      !leader.emailVerifiedAt ||
      !leader.profile?.registrationCompletedAt
    )
      throw new BadRequestException(
        "Choose an active participant who has completed registration.",
      );
    const event = await this.prisma.event.upsert({
      where: { slug: "healthhack-2027" },
      update: {},
      create: {
        slug: "healthhack-2027",
        name: "HealthHack 2027",
        timezone: "Asia/Kolkata",
      },
    });
    return this.mutate(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${leader.id}::uuid FOR UPDATE`;
      const currentLeader = await tx.user.findUniqueOrThrow({
        where: { id: leader.id },
        include: { profile: true },
      });
      if (
        currentLeader.suspendedAt ||
        currentLeader.deletedAt ||
        !currentLeader.emailVerifiedAt ||
        !currentLeader.profile?.registrationCompletedAt
      )
        throw new BadRequestException(
          "This participant is no longer eligible to lead a team.",
        );
      if (await tx.teamMember.findUnique({ where: { userId: leader.id } }))
        throw new ConflictException("This participant is already in a team.");
      const team = await tx.team.create({
        data: {
          name: input.name,
          description: input.description ?? "",
          requiresMembers: input.requiresMembers ?? false,
          eventId: event.id,
          members: { create: { userId: leader.id, role: "TEAM_LEADER" } },
        },
      });
      await tx.user.update({
        where: { id: leader.id },
        data: { wantsToJoinTeam: false },
      });
      await tx.participant.upsert({
        where: { eventId_userId: { eventId: event.id, userId: leader.id } },
        update: {},
        create: {
          eventId: event.id,
          userId: leader.id,
          participantCode: leader.participantId,
          status: "ACTIVE",
        },
      });
      await tx.teamJoinRequest.updateMany({
        where: { userId: leader.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await tx.teamRecruitmentInvitation.updateMany({
        where: { userId: leader.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await this.audit(
        tx,
        actorId,
        "org.team.create",
        "Team",
        team.id,
        { leaderId: leader.id, teamCode: team.teamCode },
        context,
      );
      return team;
    });
  }
  async teamInvitations(teamId: string) {
    const requests = await this.prisma.teamJoinRequest.findMany({
      where: { teamId, status: "PENDING" },
      select: {
        id: true,
        user: {
          select: {
            participantId: true,
            profile: { select: { fullName: true } },
          },
        },
      },
    });
    const invitations = await this.prisma.teamRecruitmentInvitation.findMany({
      where: { teamId, status: "PENDING" },
      select: {
        id: true,
        user: {
          select: {
            participantId: true,
            profile: { select: { fullName: true } },
          },
        },
      },
    });
    return [
      ...requests.map((request) => ({ ...request, kind: "request" })),
      ...invitations.map((invitation) => ({
        ...invitation,
        kind: "invitation",
      })),
    ];
  }
  async revokeTeamRequest(
    actorId: string,
    teamId: string,
    requestId: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(
      z.object({ kind: z.enum(["request", "invitation"]) }),
      body,
    );
    return this.mutate(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
      const result =
        input.kind === "request"
          ? await tx.teamJoinRequest.updateMany({
              where: { id: requestId, teamId, status: "PENDING" },
              data: { status: "CANCELLED" },
            })
          : await tx.teamRecruitmentInvitation.updateMany({
              where: { id: requestId, teamId, status: "PENDING" },
              data: { status: "CANCELLED" },
            });
      if (!result.count)
        throw new ConflictException("Pending request or invitation not found.");
      await this.audit(
        tx,
        actorId,
        "org.team.invitation.revoke",
        "Team",
        teamId,
        { requestId, kind: input.kind },
        context,
      );
      return { revoked: true };
    });
  }
  async teamDetails(teamId: string) {
    return this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        teamCode: true,
        members: {
          select: {
            userId: true,
            role: true,
            user: {
              select: {
                participantId: true,
                profile: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });
  }
  async manageMember(
    actorId: string,
    teamId: string,
    memberId: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(
      z.object({ action: z.enum(["remove", "leader"]) }),
      body,
    );
    return this.mutate(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
      const member = await tx.teamMember.findUnique({
        where: { userId: memberId },
      });
      if (!member || member.teamId !== teamId)
        throw new NotFoundException("Team member not found.");
      if (input.action === "remove") {
        if (member.role === "TEAM_LEADER")
          throw new BadRequestException(
            "Transfer leadership before removing the leader.",
          );
        await tx.teamMember.delete({ where: { userId: memberId } });
      } else {
        await tx.teamMember.updateMany({
          where: { teamId, role: "TEAM_LEADER" },
          data: { role: "TEAM_MEMBER" },
        });
        await tx.teamMember.update({
          where: { userId: memberId },
          data: { role: "TEAM_LEADER" },
        });
      }
      await this.audit(
        tx,
        actorId,
        `org.team.member.${input.action}`,
        "Team",
        teamId,
        { memberId },
        context,
      );
      return { changed: true };
    });
  }
  async editTeam(
    actorId: string,
    teamId: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(adminTeamUpdateSchema, body);
    return this.mutate(async (tx) => {
      const team = await tx.team.update({
        where: { id: teamId },
        data: {
          name: input.name,
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.requiresMembers === undefined
            ? {}
            : { requiresMembers: input.requiresMembers }),
        },
      });
      await this.audit(
        tx,
        actorId,
        "org.team.update",
        "Team",
        teamId,
        { name: team.name },
        context,
      );
      return team;
    });
  }
  async deleteTeam(actorId: string, teamId: string, context: RequestContext) {
    return this.mutate(async (tx) => {
      const team = await tx.team.delete({ where: { id: teamId } });
      await this.audit(
        tx,
        actorId,
        "org.team.delete",
        "Team",
        teamId,
        { name: team.name, teamCode: team.teamCode },
        context,
      );
      return { deleted: true };
    });
  }
  async announcements() {
    return this.prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async publicAnnouncements() {
    return this.prisma.announcement.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: { id: true, title: true, body: true, publishedAt: true },
    });
  }
  async saveAnnouncement(
    actorId: string,
    id: string | null,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(announcementSchema, body);
    const previous = id
      ? await this.prisma.announcement.findUnique({ where: { id } })
      : null;
    if (previous && previous.published !== input.published)
      await this.authorize(actorId, "org.announcements.publish");
    if (input.published)
      await this.authorize(actorId, "org.announcements.publish");
    return this.mutate(async (tx) => {
      if (id) {
        await tx.$queryRaw`SELECT "id" FROM "Announcement" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const current = await tx.announcement.findUniqueOrThrow({
          where: { id },
        });
        if (current.published !== input.published)
          await this.authorize(actorId, "org.announcements.publish");
      }
      const data = {
        ...input,
        publishedAt: input.published ? new Date() : null,
      };
      const result = id
        ? await tx.announcement.update({ where: { id }, data })
        : await tx.announcement.create({
            data: { ...data, authorId: actorId },
          });
      await this.audit(
        tx,
        actorId,
        id ? "org.announcement.update" : "org.announcement.create",
        "Announcement",
        result.id,
        { title: result.title, published: result.published },
        context,
      );
      return result;
    });
  }
  async deleteAnnouncement(
    actorId: string,
    id: string,
    context: RequestContext,
  ) {
    return this.mutate(async (tx) => {
      await tx.announcement.delete({ where: { id } });
      await this.audit(
        tx,
        actorId,
        "org.announcement.delete",
        "Announcement",
        id,
        {},
        context,
      );
      return { deleted: true };
    });
  }
  async services() {
    return this.prisma.organizationService.findMany({
      orderBy: { createdAt: "desc" },
    });
  }
  async saveService(
    actorId: string,
    id: string | null,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(
      z.object({
        name: z.string().trim().min(2).max(100),
        description: z.string().trim().min(2).max(2000),
        active: z.boolean(),
      }),
      body,
    );
    return this.mutate(async (tx) => {
      const result = id
        ? await tx.organizationService.update({ where: { id }, data: input })
        : await tx.organizationService.create({ data: input });
      await this.audit(
        tx,
        actorId,
        "org.service.save",
        "OrganizationService",
        result.id,
        { name: result.name },
        context,
      );
      return result;
    });
  }
  async deleteService(actorId: string, id: string, context: RequestContext) {
    return this.mutate(async (tx) => {
      await tx.organizationService.delete({ where: { id } });
      await this.audit(
        tx,
        actorId,
        "org.service.delete",
        "OrganizationService",
        id,
        {},
        context,
      );
      return { deleted: true };
    });
  }
  async tickets() {
    return this.prisma.supportTicket.findMany({
      take: 100,
      orderBy: { updatedAt: "desc" },
    });
  }
  async submissions(userId: string) {
    const access = await this.access(userId);
    return this.prisma.submission.findMany({
      take: 100,
      orderBy: { submittedAt: "desc" },
      include: {
        team: { select: { name: true, teamCode: true } },
        reviews: {
          where: access.permissions.includes("org.reviews.read")
            ? {}
            : { reviewerId: userId },
          select: {
            id: true,
            score: true,
            feedback: true,
            published: true,
            reviewerId: true,
          },
        },
      },
    });
  }
  async scoreSubmission(
    actorId: string,
    submissionId: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(
      z.object({
        score: z.number().int().min(0).max(100),
        feedback: z.string().trim().min(3).max(5000),
        published: z.boolean(),
      }),
      body,
    );
    if (input.published) await this.authorize(actorId, "org.reviews.publish");
    const previous = await this.prisma.submissionReview.findUnique({
      where: { submissionId_reviewerId: { submissionId, reviewerId: actorId } },
    });
    if (previous && previous.published !== input.published)
      await this.authorize(actorId, "org.reviews.publish");
    return this.mutate(async (tx) => {
      const review = await tx.submissionReview.upsert({
        where: {
          submissionId_reviewerId: { submissionId, reviewerId: actorId },
        },
        create: { ...input, submissionId, reviewerId: actorId },
        update: input,
      });
      await this.audit(
        tx,
        actorId,
        "org.review.score",
        "SubmissionReview",
        review.id,
        { score: review.score, published: review.published },
        context,
      );
      return review;
    });
  }
  async saveTicket(
    actorId: string,
    id: string | null,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(
      z.object({
        subject: z.string().trim().min(3).max(160),
        message: z.string().trim().min(3).max(5000),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
        assignedTo: z.string().trim().max(160).nullable(),
      }),
      body,
    );
    const previous = id
      ? await this.prisma.supportTicket.findUnique({ where: { id } })
      : null;
    if (previous?.status === "RESOLVED" && previous.status !== input.status)
      await this.authorize(actorId, "org.support.resolve");
    if (previous && previous.assignedTo !== input.assignedTo)
      await this.authorize(actorId, "org.support.assign");
    if (input.status === "RESOLVED")
      await this.authorize(actorId, "org.support.resolve");
    if (input.assignedTo) await this.authorize(actorId, "org.support.assign");
    return this.mutate(async (tx) => {
      if (id) {
        await tx.$queryRaw`SELECT "id" FROM "SupportTicket" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const current = await tx.supportTicket.findUniqueOrThrow({
          where: { id },
        });
        if (current.assignedTo !== input.assignedTo)
          await this.authorize(actorId, "org.support.assign");
        if (current.status === "RESOLVED" && current.status !== input.status)
          await this.authorize(actorId, "org.support.resolve");
      }
      const result = id
        ? await tx.supportTicket.update({ where: { id }, data: input })
        : await tx.supportTicket.create({ data: input });
      await this.audit(
        tx,
        actorId,
        "org.support.save",
        "SupportTicket",
        result.id,
        { status: result.status },
        context,
      );
      return result;
    });
  }
  async deleteTicket(actorId: string, id: string, context: RequestContext) {
    return this.mutate(async (tx) => {
      await tx.supportTicket.delete({ where: { id } });
      await this.audit(
        tx,
        actorId,
        "org.support.delete",
        "SupportTicket",
        id,
        {},
        context,
      );
      return { deleted: true };
    });
  }

  private async confirmPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await argon2.verify(user.passwordHash, password)))
      throw new UnauthorizedException("Your password is incorrect.");
  }
  private async confirmSuperAdmin(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.globalRole !== "SUPER_ADMIN" || user.suspendedAt || user.deletedAt)
      throw new ForbiddenException(
        "Only a super admin can change roles or permissions.",
      );
    await this.confirmPassword(userId, password);
  }
  private async requireActiveSuperAdmin(
    tx: Prisma.TransactionClient,
    actorId: string,
  ) {
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    if (
      actor.globalRole !== "SUPER_ADMIN" ||
      actor.suspendedAt ||
      actor.deletedAt
    )
      throw new ForbiddenException(
        "Super admin access has changed. Sign in again.",
      );
  }
  private async protectLastSuperAdmin(tx: Prisma.TransactionClient) {
    if (
      (await tx.user.count({
        where: {
          globalRole: "SUPER_ADMIN",
          suspendedAt: null,
          deletedAt: null,
        },
      })) <= 1
    )
      throw new BadRequestException(
        "At least one active super admin must remain.",
      );
  }
  private async lockAdministration(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "OrganizationRole" WHERE "builtInKey" = 'SUPER_ADMIN' FOR UPDATE`;
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    after: Prisma.InputJsonObject,
    context: RequestContext,
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action,
        entityType,
        entityId,
        after,
        correlationId: context.requestId,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  }
  private parse<T>(
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    body: unknown,
  ): T {
    const result = schema.safeParse(body);
    if (!result.success)
      throw new BadRequestException(
        result.error.issues[0]?.message ?? "Invalid input.",
      );
    return result.data;
  }
  private async mutate<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(work);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        if (error.code === "P2002")
          throw new ConflictException("That name is already in use.");
        if (error.code === "P2025")
          throw new NotFoundException("Record not found.");
        if (error.code === "P2003")
          throw new ConflictException("This record is still in use.");
      }
      throw error;
    }
  }
}
