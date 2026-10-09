import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import argon2 from "argon2";
import type { z } from "zod";
import {
  educationSchema,
  skillsSchema,
  usernameSchema,
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  resetPasswordSchema,
} from "@healthhack/contracts";
import { buildEmailVerificationMessage } from "@healthhack/email";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { EmailQueueService } from "../email/email-queue.service.js";
import { generateOpaqueToken, hashToken } from "../common/tokens.js";
import type { RequestContext } from "../common/request-context.js";

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  async register(body: unknown, context: RequestContext) {
    const input = this.parse(registerSchema, body);
    const fullName = [input.firstName, input.middleName, input.lastName]
      .filter(Boolean)
      .join(" ");
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const verificationToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          username: input.username,
          passwordHash,
          profile: {
            create: {
              fullName,
              firstName: input.firstName,
              middleName: input.middleName,
              lastName: input.lastName,
              skills: [],
            },
          },
          emailTokens: {
            create: {
              tokenHash: hashToken(verificationToken),
              expiresAt,
            },
          },
        },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          profile: {
            select: {
              fullName: true,
            },
          },
        },
      });

      await this.emailQueue.queueEmail({
        recipientUserId: user.id,
        ...buildEmailVerificationMessage({
          appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
          email: user.email,
          fullName: user.profile?.fullName ?? fullName,
          token: verificationToken,
        }),
      });

      await this.audit.record({
        actorUserId: user.id,
        action: "identity.register",
        entityType: "User",
        entityId: user.id,
        after: { email: user.email },
        correlationId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return {
        user,
        verificationEmailQueued: true,
      };
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          "This email or username is already registered.",
        );
      }
      throw error;
    }
  }

  async verifyEmail(body: unknown, context: RequestContext) {
    const input = this.parse(verifyEmailSchema, body);
    const tokenHash = hashToken(input.token);
    const token = await this.prisma.emailVerification.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        "Verification token is invalid or expired.",
      );
    }
    if (token.user.suspendedAt || token.user.deletedAt)
      throw new UnauthorizedException("This account is not active.");

    const sessionToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const user = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerification.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException(
          "Verification token is invalid or expired.",
        );
      await tx.userSession.create({
        data: {
          userId: token.userId,
          tokenHash: hashToken(sessionToken),
          expiresAt,
        },
      });
      return tx.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: new Date() },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
        },
      });
    });

    await this.audit.record({
      actorUserId: user.id,
      action: "identity.email_verified",
      entityType: "User",
      entityId: user.id,
      correlationId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { user, sessionToken, expiresAt };
  }

  async usernameAvailability(value: unknown) {
    const username = this.parse(usernameSchema, value);
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    return { username, available: !user };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    if (user.emailVerifiedAt) return { verificationEmailQueued: false };
    const latest = await this.prisma.emailVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (latest && latest.createdAt.getTime() > Date.now() - 60_000)
      throw new BadRequestException(
        "Please wait one minute before requesting another verification email.",
      );
    const token = generateOpaqueToken();
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerification.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.emailVerification.create({
        data: {
          userId,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
    });
    await this.emailQueue.queueEmail({
      recipientUserId: userId,
      ...buildEmailVerificationMessage({
        appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
        email: user.email,
        fullName: user.profile?.fullName ?? user.email,
        token,
      }),
    });
    return { verificationEmailQueued: true };
  }

  async saveEducation(userId: string, body: unknown) {
    await this.requireVerified(userId);
    const input = this.parse(educationSchema, body);
    return this.prisma.userProfile.update({
      where: { userId },
      data: {
        ...input,
        passoutDate: new Date(input.passoutDate),
        graduationYear: new Date(input.passoutDate).getUTCFullYear(),
      },
    });
  }

  async saveSkills(userId: string, body: unknown) {
    await this.requireVerified(userId);
    const input = this.parse(skillsSchema, body);
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (
      !profile?.college ||
      !profile.passoutDate ||
      !profile.studyYear ||
      !profile.branch ||
      !profile.discipline
    ) {
      throw new BadRequestException("Complete your education details first.");
    }
    return this.prisma.userProfile.update({
      where: { userId },
      data: {
        skills: input.skills.map((skill) => skill.name),
        skillExpertise: input.skills,
        registrationCompletedAt: new Date(),
      },
    });
  }

  private async requireVerified(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    if (!user.emailVerifiedAt)
      throw new ForbiddenException(
        "Verify your email before completing registration.",
      );
  }

  async login(body: unknown, context: RequestContext) {
    const input = this.parse(loginSchema, body);
    const identifier = (
      "email" in input ? input.email : input.identifier
    ).toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        emailVerifiedAt: true,
        globalRole: true,
        organizationRoleId: true,
        suspendedAt: true,
        deletedAt: true,
        profile: { select: { fullName: true } },
      },
    });

    if (
      !user ||
      user.suspendedAt ||
      user.deletedAt ||
      !(await argon2.verify(user.passwordHash, input.password))
    ) {
      throw new UnauthorizedException(
        "Invalid credentials or inactive account.",
      );
    }

    const sessionToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(sessionToken),
        expiresAt,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSignInAt: new Date() },
    });

    await this.audit.record({
      actorUserId: user.id,
      action: "identity.login",
      entityType: "User",
      entityId: user.id,
      correlationId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      sessionToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
        profile: user.profile,
        organizationAccess: Boolean(user.globalRole || user.organizationRoleId),
      },
    };
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        username: true,
        participantId: true,
        globalRole: true,
        organizationRoleId: true,
        profile: true,
        participants: {
          select: {
            id: true,
            eventId: true,
            participantCode: true,
            status: true,
          },
        },
        teamMemberships: {
          select: {
            role: true,
            team: {
              select: {
                id: true,
                eventId: true,
                teamCode: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async resetPassword(body: unknown) {
    const input = this.parse(resetPasswordSchema, body);
    const hash = await argon2.hash(input.password, { type: argon2.argon2id });
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.passwordReset.findUnique({
        where: { tokenHash: hashToken(input.token) },
        include: { user: true },
      });
      if (!token)
        throw new UnauthorizedException(
          "Password reset link is invalid or expired.",
        );
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${token.userId}::uuid FOR UPDATE`;
      const account = await tx.user.findUniqueOrThrow({
        where: { id: token.userId },
        select: { deletedAt: true, suspendedAt: true },
      });
      if (
        token.usedAt ||
        token.expiresAt <= new Date() ||
        account.deletedAt ||
        account.suspendedAt
      )
        throw new UnauthorizedException(
          "Password reset link is invalid or expired.",
        );
      const consumed = await tx.passwordReset.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException(
          "Password reset link is invalid or expired.",
        );
      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash: hash },
      });
      await tx.userSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordReset.updateMany({
        where: { userId: token.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return { reset: true };
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
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
}
