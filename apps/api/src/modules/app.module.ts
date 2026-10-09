import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { IdentityController } from "./identity/identity.controller.js";
import { IdentityService } from "./identity/identity.service.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { AuditService } from "./audit/audit.service.js";
import { SessionGuard } from "./auth/session.guard.js";
import { TeamController } from "./teams/team.controller.js";
import { TeamService } from "./teams/team.service.js";
import { EmailQueueService } from "./email/email-queue.service.js";
import { AdminService } from "./admin/admin.service.js";
import { AdminGuard } from "./admin/admin.guard.js";
import {
  AdminController,
  PublishedAnnouncementController,
} from "./admin/admin.controller.js";

@Module({
  controllers: [
    HealthController,
    IdentityController,
    TeamController,
    AdminController,
    PublishedAnnouncementController,
  ],
  providers: [
    PrismaService,
    AuditService,
    SessionGuard,
    IdentityService,
    TeamService,
    EmailQueueService,
    AdminService,
    AdminGuard,
  ],
})
export class AppModule {}
