import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  acceptInviteSchema,
  createTeamSchema,
  inviteMemberSchema,
  joinTeamSchema,
  teammateVisibilitySchema,
} from "@healthhack/contracts";
import { buildTeamInvitationMessage } from "@healthhack/email";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { EmailQueueService } from "../email/email-queue.service.js";
import { generateOpaqueToken, hashToken } from "../common/tokens.js";
import type { Prisma } from "@healthhack/database";
import type { z } from "zod";
import type { RequestContext } from "../common/request-context.js";

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  async createTeam(
    actorUserId: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.parse(createTeamSchema, body);
    await this.requireRegistered(actorUserId);
    const event = input.eventId
      ? await this.prisma.event.findUnique({ where: { id: input.eventId } })
      : await this.prisma.event.upsert({
          where: { slug: "healthhack-2027" },
          update: {},
          create: {
            slug: "healthhack-2027",
            name: "HealthHack 2027",
            timezone: "Asia/Kolkata",
          },
        });
    if (!event) throw new NotFoundException("Event not found.");
    const team = await this.mutate(async (tx) => {
      await this.lockUser(tx, actorUserId);
      await this.requireRegistered(actorUserId, tx);
      await this.requireNoTeam(tx, actorUserId);
      const created = await tx.team.create({
        data: {
          eventId: event.id,
          name: input.name,
          trackId: input.trackId ?? null,
          problemStatementId: input.problemStatementId ?? null,
          members: { create: { userId: actorUserId, role: "TEAM_LEADER" } },
        },
      });
      await this.enroll(tx, actorUserId, event.id);
      await tx.teamJoinRequest.updateMany({
        where: { userId: actorUserId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      return created;
    });
    await this.audit.record({
      eventId: event.id,
      actorUserId,
      action: "team.create",
      entityType: "Team",
      entityId: team.id,
      after: { name: team.name, teamCode: team.teamCode },
      correlationId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return { team };
  }

  async mine(userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId },
      include: {
        team: {
          include: {
            track: { select: { name: true } },
            problemStatement: { select: { title: true, body: true } },
            members: {
              orderBy: { joinedAt: "asc" },
              include: {
                user: {
                  select: {
                    id: true,
                    participantId: true,
                    username: true,
                    profile: { select: { fullName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const requests =
      membership?.role === "TEAM_LEADER"
        ? await this.prisma.teamJoinRequest.findMany({
            where: { teamId: membership.teamId, status: "PENDING" },
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  participantId: true,
                  profile: { select: { fullName: true } },
                },
              },
            },
          })
        : [];
    const pendingRequests = await this.prisma.teamJoinRequest.findMany({
      where: { userId, status: { in: ["PENDING", "REJECTED"] } },
      orderBy: { updatedAt: "desc" },
      include: { team: { select: { name: true, teamCode: true } } },
    });
    const visibleMembership = membership
      ? {
          ...membership,
          team: {
            ...membership.team,
            joinCode:
              membership.role === "TEAM_LEADER"
                ? membership.team.joinCode
                : undefined,
          },
        }
      : null;
    return { membership: visibleMembership, requests, pendingRequests };
  }

  async teammateVisibility(userId: string, body: unknown) {
    const input = this.parse(teammateVisibilitySchema, body);
    if (input.enabled) await this.requireRegistered(userId);
    return this.mutate(async (tx) => {
      await this.lockUser(tx, userId);
      if (input.enabled) {
        await this.requireRegistered(userId, tx);
        await this.requireNoTeam(tx, userId);
      }
      await tx.user.update({
        where: { id: userId },
        data: { wantsToJoinTeam: input.enabled },
      });
      if (!input.enabled)
        await tx.teamRecruitmentInvitation.updateMany({
          where: { userId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      return { enabled: input.enabled };
    });
  }

  async discoveryState(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { wantsToJoinTeam: true },
    });
    const invitations = await this.prisma.teamRecruitmentInvitation.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        team: {
          select: {
            id: true,
            name: true,
            teamCode: true,
            members: {
              where: { role: "TEAM_LEADER" },
              select: {
                user: { select: { profile: { select: { fullName: true } } } },
              },
            },
          },
        },
      },
    });
    const sentRequests = await this.prisma.teamJoinRequest.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        team: { select: { id: true, name: true, teamCode: true } },
      },
    });
    return { enabled: user.wantsToJoinTeam, invitations, sentRequests };
  }

  async findTeammates(leaderId: string, query: string) {
    const leader = await this.prisma.teamMember.findUnique({
      where: { userId: leaderId },
    });
    if (!leader || leader.role !== "TEAM_LEADER")
      throw new ForbiddenException("Only a team leader can find teammates.");
    const candidates = await this.prisma.user.findMany({
      where: {
        wantsToJoinTeam: true,
        emailVerifiedAt: { not: null },
        suspendedAt: null,
        deletedAt: null,
        teamMemberships: { none: {} },
        profile: {
          is: {
            registrationCompletedAt: { not: null },
            OR: [
              { fullName: { contains: query.trim(), mode: "insensitive" } },
              { college: { contains: query.trim(), mode: "insensitive" } },
            ],
          },
        },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        participantId: true,
        username: true,
        profile: {
          select: {
            fullName: true,
            college: true,
            branch: true,
            discipline: true,
            graduationYear: true,
            skillExpertise: true,
            bio: true,
          },
        },
      },
    });
    const invitations = await this.prisma.teamRecruitmentInvitation.findMany({
      where: {
        teamId: leader.teamId,
        status: "PENDING",
        userId: { in: candidates.map((candidate) => candidate.id) },
      },
      select: { userId: true },
    });
    return candidates.map((candidate) => ({
      ...candidate,
      invited: invitations.some(
        (invitation) => invitation.userId === candidate.id,
      ),
    }));
  }

  async recruitingTeams(query: string) {
    const teams = await this.prisma.team.findMany({
      where: {
        requiresMembers: true,
        name: { contains: query.trim(), mode: "insensitive" },
        status: { notIn: ["LOCKED", "WITHDRAWN", "DISQUALIFIED"] },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        teamCode: true,
        description: true,
        _count: { select: { members: true } },
        event: {
          select: {
            settings: {
              where: { key: "team.maxSize" },
              select: { value: true },
            },
          },
        },
      },
    });
    return teams
      .map((team) => ({
        id: team.id,
        name: team.name,
        teamCode: team.teamCode,
        description: team.description,
        members: team._count.members,
        capacity:
          typeof team.event.settings[0]?.value === "number"
            ? team.event.settings[0].value
            : 4,
      }))
      .filter((team) => team.members < team.capacity);
  }

  async inviteTeammate(leaderId: string, candidateId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId: leaderId },
    });
    if (!membership || membership.role !== "TEAM_LEADER")
      throw new ForbiddenException(
        "Only the team leader can invite teammates.",
      );
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, membership.teamId);
      await this.lockUser(tx, candidateId);
      const team = await this.leader(tx, leaderId, membership.teamId);
      await this.checkCapacity(tx, team.id, team.eventId);
      const candidate = await tx.user.findUnique({
        where: { id: candidateId },
        include: { profile: true },
      });
      if (
        !candidate?.wantsToJoinTeam ||
        candidate.suspendedAt ||
        candidate.deletedAt ||
        !candidate.emailVerifiedAt ||
        !candidate.profile?.registrationCompletedAt
      )
        throw new NotFoundException(
          "This participant is not available for teammate discovery.",
        );
      await this.requireNoTeam(tx, candidateId);
      const previous = await tx.teamRecruitmentInvitation.findUnique({
        where: { teamId_userId: { teamId: team.id, userId: candidateId } },
      });
      if (previous?.status === "PENDING")
        throw new ConflictException("An invitation is already pending.");
      return tx.teamRecruitmentInvitation.upsert({
        where: { teamId_userId: { teamId: team.id, userId: candidateId } },
        create: { teamId: team.id, userId: candidateId },
        update: { status: "PENDING" },
      });
    });
  }

  async respondToRecruitment(
    userId: string,
    invitationId: string,
    accept: boolean,
  ) {
    const invitation = await this.prisma.teamRecruitmentInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.userId !== userId)
      throw new NotFoundException("Invitation not found.");
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, invitation.teamId);
      await this.lockUser(tx, userId);
      const current = await tx.teamRecruitmentInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      });
      if (current.status !== "PENDING")
        throw new ConflictException("This invitation is no longer pending.");
      if (accept) {
        await this.requireRegistered(userId, tx);
        await this.requireNoTeam(tx, userId);
        const team = await tx.team.findUniqueOrThrow({
          where: { id: current.teamId },
        });
        await this.checkCapacity(tx, team.id, team.eventId);
        await tx.teamMember.create({
          data: { teamId: team.id, userId, role: "TEAM_MEMBER" },
        });
        await this.enroll(tx, userId, team.eventId);
        await tx.teamJoinRequest.updateMany({
          where: { userId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      }
      return tx.teamRecruitmentInvitation.update({
        where: { id: invitationId },
        data: { status: accept ? "ACCEPTED" : "DECLINED" },
      });
    });
  }

  async recruitmentSettings(leaderId: string, body: unknown) {
    if (
      typeof body !== "object" ||
      body === null ||
      !("enabled" in body) ||
      typeof body.enabled !== "boolean"
    )
      throw new BadRequestException(
        "Choose whether this team requires members.",
      );
    const enabled = body.enabled;
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId: leaderId },
    });
    if (!membership)
      throw new ForbiddenException(
        "Only the team leader can change team recruitment.",
      );
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, membership.teamId);
      await this.leader(tx, leaderId, membership.teamId);
      return tx.team.update({
        where: { id: membership.teamId },
        data: { requiresMembers: enabled },
      });
    });
  }

  async candidateDetails(leaderId: string, candidateId: string) {
    const leader = await this.prisma.teamMember.findUnique({
      where: { userId: leaderId },
    });
    if (leader?.role !== "TEAM_LEADER")
      throw new ForbiddenException(
        "Only team leaders can view participant profiles.",
      );
    const candidate = await this.prisma.user.findFirst({
      where: {
        id: candidateId,
        wantsToJoinTeam: true,
        emailVerifiedAt: { not: null },
        suspendedAt: null,
        deletedAt: null,
        teamMemberships: { none: {} },
        profile: { is: { registrationCompletedAt: { not: null } } },
      },
      select: {
        id: true,
        participantId: true,
        username: true,
        profile: {
          select: {
            fullName: true,
            firstName: true,
            middleName: true,
            lastName: true,
            college: true,
            degree: true,
            branch: true,
            discipline: true,
            studyYear: true,
            passoutDate: true,
            graduationYear: true,
            city: true,
            state: true,
            linkedinUrl: true,
            githubUrl: true,
            portfolioUrl: true,
            skillExpertise: true,
            bio: true,
          },
        },
      },
    });
    if (!candidate)
      throw new NotFoundException(
        "This participant is no longer sharing their profile.",
      );
    return candidate;
  }

  async sentRecruitment(leaderId: string) {
    const leader = await this.prisma.teamMember.findUnique({
      where: { userId: leaderId },
    });
    if (leader?.role !== "TEAM_LEADER")
      throw new ForbiddenException(
        "Only the team leader can view sent invitations.",
      );
    return this.prisma.teamRecruitmentInvitation.findMany({
      where: { teamId: leader.teamId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            participantId: true,
            profile: { select: { fullName: true } },
          },
        },
      },
    });
  }

  async revokeRecruitment(leaderId: string, invitationId: string) {
    const invitation = await this.prisma.teamRecruitmentInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException("Invitation not found.");
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, invitation.teamId);
      await this.lockUser(tx, invitation.userId);
      await this.leader(tx, leaderId, invitation.teamId);
      const result = await tx.teamRecruitmentInvitation.updateMany({
        where: { id: invitationId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      if (!result.count)
        throw new ConflictException("Only pending invitations can be revoked.");
      return { revoked: true };
    });
  }

  async teamPreview(userId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        status: true,
        requiresMembers: true,
        members: {
          select: {
            userId: true,
            role: true,
            user: { select: { profile: { select: { fullName: true } } } },
          },
        },
      },
    });
    if (!team) throw new NotFoundException("Team not found.");
    const invitation = await this.prisma.teamRecruitmentInvitation.findFirst({
      where: { teamId, userId, status: "PENDING" },
      select: { id: true },
    });
    const request = await this.prisma.teamJoinRequest.findFirst({
      where: { teamId, userId, status: "PENDING" },
      select: { id: true },
    });
    if (
      !(
        team.requiresMembers &&
        !["LOCKED", "WITHDRAWN", "DISQUALIFIED"].includes(team.status)
      ) &&
      !invitation &&
      !request &&
      !team.members.some((member) => member.userId === userId)
    )
      throw new NotFoundException("This team is not recruiting.");
    const leader = team.members.find((member) => member.role === "TEAM_LEADER");
    const profile = leader
      ? await this.prisma.userProfile.findUnique({
          where: { userId: leader.userId },
          select: {
            fullName: true,
            college: true,
            degree: true,
            branch: true,
            discipline: true,
            studyYear: true,
            passoutDate: true,
            graduationYear: true,
            skillExpertise: true,
          },
        })
      : null;
    return {
      name: team.name,
      leader: profile,
      members: team.members
        .filter((member) => member.role !== "TEAM_LEADER")
        .map((member) => member.user.profile?.fullName ?? "Team member"),
    };
  }

  async findTeams(query: string) {
    return this.prisma.team.findMany({
      where: {
        requiresMembers: true,
        name: { contains: query.trim(), mode: "insensitive" },
        status: { notIn: ["WITHDRAWN", "DISQUALIFIED", "LOCKED"] },
      },
      take: 20,
      select: {
        id: true,
        name: true,
        teamCode: true,
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async requestJoin(userId: string, body: unknown) {
    const input = this.parse(joinTeamSchema, body);
    await this.requireRegistered(userId);
    const team = await this.prisma.team.findUnique({
      where: "code" in input ? { joinCode: input.code } : { id: input.teamId },
    });
    if (!team)
      throw new NotFoundException("No team found with this join code.");
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, team.id);
      await this.lockUser(tx, userId);
      if ("teamId" in input) {
        const current = await tx.team.findUniqueOrThrow({
          where: { id: team.id },
        });
        if (!current.requiresMembers)
          throw new NotFoundException("This team is not recruiting.");
      }
      await this.requireRegistered(userId, tx);
      await this.requireNoTeam(tx, userId);
      await this.checkCapacity(tx, team.id, team.eventId);
      const existing = await tx.teamJoinRequest.findUnique({
        where: { teamId_userId: { teamId: team.id, userId } },
      });
      if (existing?.status === "PENDING")
        throw new ConflictException(
          "Your request is already awaiting leader approval.",
        );
      const request = await tx.teamJoinRequest.upsert({
        where: { teamId_userId: { teamId: team.id, userId } },
        create: { teamId: team.id, userId },
        update: { status: "PENDING" },
      });
      return { request, team: { name: team.name, teamCode: team.teamCode } };
    });
  }

  async decideRequest(leaderId: string, requestId: string, approve: boolean) {
    const request = await this.prisma.teamJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException("Join request not found.");
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, request.teamId);
      await this.lockUser(tx, request.userId);
      const team = await this.leader(tx, leaderId, request.teamId);
      const current = await tx.teamJoinRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      if (current.status !== "PENDING")
        throw new ConflictException("This request has already been handled.");
      if (approve) {
        await this.requireRegistered(request.userId, tx);
        await this.requireNoTeam(tx, request.userId);
        await this.checkCapacity(tx, team.id, team.eventId);
        await tx.teamMember.create({
          data: {
            teamId: team.id,
            userId: request.userId,
            role: "TEAM_MEMBER",
          },
        });
        await this.enroll(tx, request.userId, team.eventId);
        await tx.teamJoinRequest.updateMany({
          where: {
            userId: request.userId,
            status: "PENDING",
            id: { not: requestId },
          },
          data: { status: "CANCELLED" },
        });
      }
      return tx.teamJoinRequest.update({
        where: { id: requestId },
        data: { status: approve ? "APPROVED" : "REJECTED" },
      });
    });
  }

  async cancelRequest(userId: string, requestId: string) {
    const request = await this.prisma.teamJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.userId !== userId)
      throw new NotFoundException("Pending request not found.");
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, request.teamId);
      await this.lockUser(tx, userId);
      const result = await tx.teamJoinRequest.updateMany({
        where: { id: requestId, userId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      if (!result.count)
        throw new NotFoundException("Pending request not found.");
      return { cancelled: true };
    });
  }

  async leaveTeam(userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId },
    });
    if (!membership) throw new NotFoundException("You are not in a team.");
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, membership.teamId);
      await this.lockUser(tx, userId);
      const current = await tx.teamMember.findUnique({ where: { userId } });
      if (!current || current.teamId !== membership.teamId)
        throw new ConflictException("Your membership has changed.");
      if (current.role === "TEAM_LEADER") {
        if (
          (await tx.teamMember.count({ where: { teamId: current.teamId } })) > 1
        )
          throw new BadRequestException(
            "Transfer leadership before leaving your team.",
          );
        await tx.team.delete({ where: { id: current.teamId } });
      } else await tx.teamMember.delete({ where: { userId } });
      return { left: true };
    });
  }

  async removeMember(leaderId: string, teamId: string, memberId: string) {
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, teamId);
      await this.lockUser(tx, memberId);
      await this.leader(tx, leaderId, teamId);
      const member = await tx.teamMember.findUnique({
        where: { userId: memberId },
      });
      if (!member || member.teamId !== teamId)
        throw new NotFoundException("Member not found.");
      if (member.role === "TEAM_LEADER")
        throw new BadRequestException("The leader cannot be removed.");
      await tx.teamMember.delete({ where: { userId: memberId } });
      return { removed: true };
    });
  }

  async transferLeader(leaderId: string, teamId: string, memberId: string) {
    return this.mutate(async (tx) => {
      await this.lockTeam(tx, teamId);
      await this.leader(tx, leaderId, teamId);
      const member = await tx.teamMember.findUnique({
        where: { userId: memberId },
      });
      if (!member || member.teamId !== teamId || memberId === leaderId)
        throw new BadRequestException("Choose another member of this team.");
      await tx.teamMember.update({
        where: { userId: leaderId },
        data: { role: "TEAM_MEMBER" },
      });
      await tx.teamMember.update({
        where: { userId: memberId },
        data: { role: "TEAM_LEADER" },
      });
      return { transferred: true };
    });
  }

  private async requireRegistered(
    userId: string,
    db: Pick<Prisma.TransactionClient, "user"> = this.prisma,
  ) {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    if (user.suspendedAt || user.deletedAt)
      throw new ForbiddenException("This account is not active.");
    if (!user.emailVerifiedAt || !user.profile?.registrationCompletedAt)
      throw new ForbiddenException(
        "Complete your registration before creating or joining a team.",
      );
  }

  private async lockUser(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  }
  private async lockTeam(tx: Prisma.TransactionClient, teamId: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Team" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
    if (!rows.length) throw new NotFoundException("Team no longer exists.");
  }
  private async requireNoTeam(tx: Prisma.TransactionClient, userId: string) {
    if (await tx.teamMember.findUnique({ where: { userId } }))
      throw new ConflictException(
        "You can only belong to one team. Leave your current team first.",
      );
  }
  private async leader(
    tx: Prisma.TransactionClient,
    userId: string,
    teamId: string,
  ) {
    const member = await tx.teamMember.findUnique({
      where: { userId },
      include: { team: true },
    });
    if (!member || member.teamId !== teamId || member.role !== "TEAM_LEADER")
      throw new ForbiddenException(
        "Only the team leader can perform this action.",
      );
    return member.team;
  }
  private async checkCapacity(
    tx: Prisma.TransactionClient,
    teamId: string,
    eventId: string,
  ) {
    const team = await tx.team.findUniqueOrThrow({ where: { id: teamId } });
    if (["LOCKED", "WITHDRAWN", "DISQUALIFIED"].includes(team.status))
      throw new BadRequestException("This team is not accepting members.");
    const setting = await tx.eventSetting.findUnique({
      where: { eventId_key: { eventId, key: "team.maxSize" } },
    });
    const maximum = typeof setting?.value === "number" ? setting.value : 4;
    if ((await tx.teamMember.count({ where: { teamId } })) >= maximum)
      throw new BadRequestException("This team is full.");
  }
  private async enroll(
    tx: Prisma.TransactionClient,
    userId: string,
    eventId: string,
  ) {
    await tx.user.update({
      where: { id: userId },
      data: { wantsToJoinTeam: false },
    });
    await tx.teamRecruitmentInvitation.updateMany({
      where: { userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { participantId: true },
    });
    await tx.participant.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: {},
      create: {
        eventId,
        userId,
        participantCode: user.participantId,
        status: "ACTIVE",
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
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "This team name, code, or membership already exists.",
        );
      throw error;
    }
  }

  async inviteMember(
    actorUserId: string,
    teamId: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = inviteMemberSchema.parse(body);
    const team = await this.requireLeader(actorUserId, teamId);
    await this.ensureTeamHasCapacity(team.id, team.eventId);

    const token = generateOpaqueToken();
    const invitation = await this.prisma.teamInvitation.create({
      data: {
        teamId: team.id,
        invitedEmail: input.email.toLowerCase(),
        invitedName: input.name ?? null,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      select: {
        id: true,
        invitedEmail: true,
        invitedName: true,
        status: true,
        expiresAt: true,
      },
    });

    await this.emailQueue.queueEmail({
      eventId: team.eventId,
      ...buildTeamInvitationMessage({
        appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
        email: invitation.invitedEmail,
        invitedName: invitation.invitedName,
        teamName: team.name,
        token,
      }),
    });

    await this.audit.record({
      eventId: team.eventId,
      actorUserId,
      actorContext: "TEAM_LEADER",
      action: "team.invite_member",
      entityType: "TeamInvitation",
      entityId: invitation.id,
      after: invitation,
      correlationId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      invitation,
      inviteToken: process.env.NODE_ENV === "production" ? undefined : token,
    };
  }

  async acceptInvite(
    actorUserId: string,
    body: unknown,
    context: RequestContext,
  ) {
    await this.requireRegistered(actorUserId);
    const input = acceptInviteSchema.parse(body);
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { tokenHash: hashToken(input.token) },
      include: { team: true },
    });

    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BadRequestException("Invitation is invalid or expired.");
    }

    const actor = await this.prisma.user.findUniqueOrThrow({
      where: { id: actorUserId },
      select: { email: true },
    });
    if (actor.email.toLowerCase() !== invitation.invitedEmail.toLowerCase())
      throw new ForbiddenException(
        "This invitation was sent to a different email address.",
      );

    await this.ensureTeamHasCapacity(
      invitation.teamId,
      invitation.team.eventId,
    );

    const membership = await this.mutate(async (tx) => {
      await this.lockTeam(tx, invitation.teamId);
      await this.lockUser(tx, actorUserId);
      await this.checkCapacity(tx, invitation.teamId, invitation.team.eventId);
      await this.requireRegistered(actorUserId, tx);
      const currentInvitation = await tx.teamInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      if (
        currentInvitation.status !== "PENDING" ||
        currentInvitation.expiresAt <= new Date()
      )
        throw new BadRequestException("Invitation is invalid or expired.");
      const existing = await tx.teamMember.findFirst({
        where: {
          userId: actorUserId,
        },
      });
      if (existing) {
        throw new BadRequestException(
          "You are already a member of a team for this event.",
        );
      }

      const member = await tx.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId: actorUserId,
          role: "TEAM_MEMBER",
        },
      });
      await tx.teamJoinRequest.updateMany({
        where: { userId: actorUserId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedUserId: actorUserId,
        },
      });
      await this.enroll(tx, actorUserId, invitation.team.eventId);
      return member;
    });

    await this.audit.record({
      eventId: invitation.team.eventId,
      actorUserId,
      actorContext: "TEAM_MEMBER",
      action: "team.invitation_accept",
      entityType: "TeamInvitation",
      entityId: invitation.id,
      after: { teamId: invitation.teamId, userId: actorUserId },
      correlationId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { membership };
  }

  async listTeams(actorUserId: string, eventId: string) {
    await this.requireEventPermission(actorUserId, eventId, "teams.read");
    return this.prisma.team.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        teamCode: true,
        name: true,
        status: true,
        members: {
          select: {
            role: true,
            user: {
              select: {
                email: true,
                profile: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });
  }

  private async requireLeader(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      include: { team: true },
    });

    if (!membership || membership.role !== "TEAM_LEADER") {
      throw new ForbiddenException(
        "Only the team leader can perform this action.",
      );
    }

    return membership.team;
  }

  private async ensureTeamHasCapacity(teamId: string, eventId: string) {
    const [memberCount, setting] = await Promise.all([
      this.prisma.teamMember.count({ where: { teamId } }),
      this.prisma.eventSetting.findUnique({
        where: { eventId_key: { eventId, key: "team.maxSize" } },
      }),
    ]);
    const maxSize = typeof setting?.value === "number" ? setting.value : 4;
    if (memberCount >= maxSize) {
      throw new BadRequestException(
        "This team has reached the maximum allowed size.",
      );
    }
  }

  private async requireEventPermission(
    userId: string,
    eventId: string,
    permissionKey: string,
  ) {
    const assignment = await this.prisma.eventRoleAssignment.findFirst({
      where: {
        userId,
        eventId,
        role: {
          permissions: {
            some: {
              permission: {
                key: permissionKey,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        "You do not have permission for this event operation.",
      );
    }
  }
}
