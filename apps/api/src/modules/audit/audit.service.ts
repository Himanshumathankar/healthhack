import { Injectable } from "@nestjs/common";
import type { Prisma } from "@healthhack/database";
import { PrismaService } from "../prisma/prisma.service.js";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  const serialized: unknown = JSON.parse(JSON.stringify(value));
  return serialized as Prisma.InputJsonValue;
}

type AuditInput = {
  eventId?: string | undefined;
  actorUserId?: string | undefined;
  actorContext?: string | undefined;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  correlationId: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      correlationId: input.correlationId,
      eventId: input.eventId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorContext: input.actorContext ?? null,
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      ...(input.before === undefined ? {} : { before: toJsonValue(input.before) }),
      ...(input.after === undefined ? {} : { after: toJsonValue(input.after) })
    };

    await this.prisma.auditLog.create({
      data
    });
  }
}
