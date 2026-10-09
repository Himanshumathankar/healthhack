import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  DefaultValuePipe,
  BadRequestException,
} from "@nestjs/common";
import { organizationPermissions } from "@healthhack/contracts";
import { SessionGuard } from "../auth/session.guard.js";
import { CurrentUser, type AuthenticatedUser } from "../common/current-user.js";
import { RequestMeta, type RequestContext } from "../common/request-context.js";
import { AdminGuard, OrgPermission, OrgIdentity } from "./admin.guard.js";
import { AdminService } from "./admin.service.js";

@Controller("admin")
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get("me") @OrgIdentity() me(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.access(user.id);
  }
  @Get("overview") @OrgPermission("org.dashboard.read") overview() {
    return this.admin.overview();
  }
  @Get("submissions") @OrgPermission("org.submissions.read") submissions(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.submissions(user.id);
  }
  @Post("submissions/:id/review")
  @OrgPermission("org.reviews.score")
  scoreSubmission(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.scoreSubmission(user.id, id, body, context);
  }
  @Get("users") @OrgPermission("org.users.read") users(
    @Query("q") query = "",
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    if (page < 1 || page > 100000)
      throw new BadRequestException("Invalid page.");
    return this.admin.users(query, page);
  }
  @Post("users/:id/role") @OrgPermission("org.users.roles.assign") changeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.changeRole(user.id, id, body, context);
  }
  @Post("users/:id/action") @OrgPermission("org.users.read") userAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.userAction(user.id, id, body, context);
  }
  @Get("roles") @OrgPermission("org.roles.read") roles() {
    return this.admin.roles();
  }
  @Get("permissions") @OrgPermission("org.roles.read") permissions() {
    return organizationPermissions;
  }
  @Post("roles") @OrgPermission("org.roles.create") createRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.saveRole(user.id, null, body, context);
  }
  @Post("roles/:id") @OrgPermission("org.roles.update") updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.saveRole(user.id, id, body, context);
  }
  @Post("roles/:id/delete") @OrgPermission("org.roles.delete") deleteRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.deleteRole(user.id, id, context);
  }
  @Post("roles/:id/permissions")
  @OrgPermission("org.roles.permissions.update")
  rolePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.updatePermissions(user.id, id, body, context);
  }
  @Get("sessions") @OrgPermission("org.sessions.read") sessions() {
    return this.admin.sessions();
  }
  @Post("sessions/:id/revoke") @OrgPermission("org.sessions.revoke") revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.revokeSession(user.id, id, context);
  }
  @Get("audit") @OrgPermission("org.audit.read") audit() {
    return this.admin.auditLog();
  }
  @Get("teams") @OrgPermission("org.teams.read") teams() {
    return this.admin.teams();
  }
  @Get("teams/:id") @OrgPermission("org.teams.read") teamDetails(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.admin.teamDetails(id);
  }
  @Post("teams") @OrgPermission("org.teams.create") createTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.createTeam(user.id, body, context);
  }
  @Get("teams/:id/invitations")
  @OrgPermission("org.teams.invitations.manage")
  teamInvitations(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.teamInvitations(id);
  }
  @Post("teams/:id/invitations/:requestId/revoke")
  @OrgPermission("org.teams.invitations.manage")
  revokeTeamRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.revokeTeamRequest(user.id, id, requestId, body, context);
  }
  @Post("teams/:id/members/:memberId")
  @OrgPermission("org.teams.members.manage")
  manageMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.manageMember(user.id, id, memberId, body, context);
  }
  @Post("teams/:id") @OrgPermission("org.teams.update") editTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.editTeam(user.id, id, body, context);
  }
  @Post("teams/:id/delete") @OrgPermission("org.teams.delete") deleteTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.deleteTeam(user.id, id, context);
  }
  @Get("announcements")
  @OrgPermission("org.announcements.read")
  announcements() {
    return this.admin.announcements();
  }
  @Post("announcements")
  @OrgPermission("org.announcements.create")
  createAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.saveAnnouncement(user.id, null, body, context);
  }
  @Post("announcements/:id")
  @OrgPermission("org.announcements.update")
  updateAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.saveAnnouncement(user.id, id, body, context);
  }
  @Post("announcements/:id/delete")
  @OrgPermission("org.announcements.delete")
  deleteAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.deleteAnnouncement(user.id, id, context);
  }
  @Get("services") @OrgPermission("org.services.read") services() {
    return this.admin.services();
  }
  @Post("services") @OrgPermission("org.services.create") createService(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.saveService(user.id, null, body, context);
  }
  @Post("services/:id") @OrgPermission("org.services.update") updateService(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.saveService(user.id, id, body, context);
  }
  @Post("services/:id/delete")
  @OrgPermission("org.services.delete")
  deleteService(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.deleteService(user.id, id, context);
  }
  @Get("support") @OrgPermission("org.support.read") support() {
    return this.admin.tickets();
  }
  @Post("support") @OrgPermission("org.support.create") createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.saveTicket(user.id, null, body, context);
  }
  @Post("support/:id") @OrgPermission("org.support.update") updateTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.saveTicket(user.id, id, body, context);
  }
  @Post("support/:id/delete") @OrgPermission("org.support.delete") deleteTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @RequestMeta() context: RequestContext,
  ) {
    return this.admin.deleteTicket(user.id, id, context);
  }
}

@Controller("announcements")
@UseGuards(SessionGuard)
export class PublishedAnnouncementController {
  constructor(private readonly admin: AdminService) {}
  @Get() list() {
    return this.admin.publicAnnouncements();
  }
}
