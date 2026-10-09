import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import crypto from "node:crypto";

export type RequestContext = {
  requestId: string;
  ipAddress: string | undefined;
  userAgent: string | undefined;
};

export const RequestMeta = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestContext => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const requestId =
    typeof request.headers["x-request-id"] === "string"
      ? request.headers["x-request-id"]
      : crypto.randomUUID();

  return {
    requestId,
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"]
  };
});
