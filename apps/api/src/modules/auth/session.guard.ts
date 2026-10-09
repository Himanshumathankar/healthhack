import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { hashToken } from "../common/tokens.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthenticatedRequest } from "../common/current-user.js";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing session token.");
    }

    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.suspendedAt ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException("Session is invalid or expired.");
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
    };
    response.setHeader("x-authenticated-user-id", session.user.id);
    return true;
  }
}
