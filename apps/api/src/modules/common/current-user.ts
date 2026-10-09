import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
