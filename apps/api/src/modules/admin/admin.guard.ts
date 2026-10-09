import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "../common/current-user.js";
import { AdminService } from "./admin.service.js";

export const OrgPermission = (permission: string) =>
  SetMetadata("organizationPermission", permission);
export const OrgIdentity = () => SetMetadata("organizationIdentity", true);
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly admin: AdminService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) return false;
    const permission = this.reflector.getAllAndOverride<string | undefined>(
      "organizationPermission",
      [context.getHandler(), context.getClass()],
    );
    if (permission) await this.admin.authorize(request.user.id, permission);
    else {
      const identity = this.reflector.getAllAndOverride<boolean | undefined>(
        "organizationIdentity",
        [context.getHandler(), context.getClass()],
      );
      if (!identity)
        throw new ForbiddenException(
          "This endpoint has no registered permission.",
        );
      await this.admin.access(request.user.id);
    }
    return true;
  }
}
