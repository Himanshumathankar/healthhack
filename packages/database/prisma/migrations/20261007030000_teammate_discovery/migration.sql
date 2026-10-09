BEGIN;
ALTER TABLE "User" ADD COLUMN "wantsToJoinTeam" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "TeamRecruitmentInvitation" (
  "id" UUID NOT NULL PRIMARY KEY, "teamId" UUID NOT NULL, "userId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "TeamRecruitmentInvitation_status" CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'))
);
CREATE UNIQUE INDEX "TeamRecruitmentInvitation_teamId_userId_key" ON "TeamRecruitmentInvitation"("teamId", "userId");
CREATE INDEX "TeamRecruitmentInvitation_userId_status_idx" ON "TeamRecruitmentInvitation"("userId", "status");
COMMIT;
