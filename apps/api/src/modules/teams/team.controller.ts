import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { TeamService } from "./team.service.js";
import { SessionGuard } from "../auth/session.guard.js";
import { CurrentUser, type AuthenticatedUser } from "../common/current-user.js";
import { RequestMeta, type RequestContext } from "../common/request-context.js";

@Controller("teams")
@UseGuards(SessionGuard)
export class TeamController {
  constructor(private readonly teams: TeamService) {}

  @Post("recruitment-settings")
  recruitmentSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.teams.recruitmentSettings(user.id, body);
  }
  @Get("teammates/:candidateId/profile")
  candidateDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param("candidateId") id: string,
  ) {
    return this.teams.candidateDetails(user.id, id);
  }
  @Get("recruitment/sent")
  sentRecruitment(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.sentRecruitment(user.id);
  }
  @Post("recruitment/:invitationId/revoke")
  revokeRecruitment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("invitationId") id: string,
  ) {
    return this.teams.revokeRecruitment(user.id, id);
  }
  @Get(":teamId/preview")
  teamPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("teamId") id: string,
  ) {
    return this.teams.teamPreview(user.id, id);
  }

  @Get("discovery")
  discovery(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.discoveryState(user.id);
  }
  @Post("discovery")
  visibility(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.teams.teammateVisibility(user.id, body);
  }
  @Get("teammates")
  teammates(@CurrentUser() user: AuthenticatedUser, @Query("q") query = "") {
    return this.teams.findTeammates(user.id, query);
  }
  @Get("recruiting")
  recruiting(@Query("q") query = "") {
    return this.teams.recruitingTeams(query);
  }
  @Post("teammates/:candidateId/invite")
  inviteTeammate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("candidateId") id: string,
  ) {
    return this.teams.inviteTeammate(user.id, id);
  }
  @Post("recruitment/:invitationId/accept")
  acceptRecruitment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("invitationId") id: string,
  ) {
    return this.teams.respondToRecruitment(user.id, id, true);
  }
  @Post("recruitment/:invitationId/decline")
  declineRecruitment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("invitationId") id: string,
  ) {
    return this.teams.respondToRecruitment(user.id, id, false);
  }

  @Get("mine")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.mine(user.id);
  }

  @Get("find")
  find(@Query("q") query = "") {
    return this.teams.findTeams(query);
  }

  @Post("join-requests")
  requestJoin(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.teams.requestJoin(user.id, body);
  }

  @Post("join-requests/:requestId/approve")
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId") id: string,
  ) {
    return this.teams.decideRequest(user.id, id, true);
  }

  @Post("join-requests/:requestId/reject")
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId") id: string,
  ) {
    return this.teams.decideRequest(user.id, id, false);
  }

  @Post("join-requests/:requestId/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId") id: string,
  ) {
    return this.teams.cancelRequest(user.id, id);
  }

  @Post("leave")
  leave(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.leaveTeam(user.id);
  }

  @Post(":teamId/members/:memberId/remove")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("teamId") teamId: string,
    @Param("memberId") memberId: string,
  ) {
    return this.teams.removeMember(user.id, teamId, memberId);
  }

  @Post(":teamId/members/:memberId/leader")
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("teamId") teamId: string,
    @Param("memberId") memberId: string,
  ) {
    return this.teams.transferLeader(user.id, teamId, memberId);
  }

  @Post()
  createTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.teams.createTeam(user.id, body, context);
  }

  @Post(":teamId/invitations")
  inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("teamId") teamId: string,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.teams.inviteMember(user.id, teamId, body, context);
  }

  @Post("invitations/accept")
  acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @RequestMeta() context: RequestContext,
  ) {
    return this.teams.acceptInvite(user.id, body, context);
  }

  @Get()
  listTeams(
    @CurrentUser() user: AuthenticatedUser,
    @Query("eventId") eventId: string,
  ) {
    return this.teams.listTeams(user.id, eventId);
  }
}
