import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { IdentityController } from "./identity/identity.controller.js";
import { PrismaService } from "./prisma/prisma.service.js";

@Module({
  controllers: [HealthController, IdentityController],
  providers: [PrismaService]
})
export class AppModule {}
