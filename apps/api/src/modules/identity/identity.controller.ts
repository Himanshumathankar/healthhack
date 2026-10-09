import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { IdentityService } from "./identity.service.js";
import { RequestMeta, type RequestContext } from "../common/request-context.js";
import { CurrentUser, type AuthenticatedUser } from "../common/current-user.js";
import { SessionGuard } from "../auth/session.guard.js";

@Controller("identity")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post("reset-password")
  resetPassword(@Body() body: unknown) {
    return this.identity.resetPassword(body);
  }

  @Post("resend-verification")
  @UseGuards(SessionGuard)
  resendVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.identity.resendVerification(user.id);
  }

  @Get("username-availability")
  usernameAvailability(@Query("username") username: string) {
    return this.identity.usernameAvailability(username);
  }

  @Post("education")
  @UseGuards(SessionGuard)
  education(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.identity.saveEducation(user.id, body);
  }

  @Post("skills")
  @UseGuards(SessionGuard)
  skills(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.identity.saveSkills(user.id, body);
  }

  @Post("register")
  register(@Body() body: unknown, @RequestMeta() context: RequestContext) {
    return this.identity.register(body, context);
  }

  @Post("verify-email")
  verifyEmail(@Body() body: unknown, @RequestMeta() context: RequestContext) {
    return this.identity.verifyEmail(body, context);
  }

  @Post("login")
  login(@Body() body: unknown, @RequestMeta() context: RequestContext) {
    return this.identity.login(body, context);
  }

  @Get("me")
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.identity.me(user.id);
  }
}
