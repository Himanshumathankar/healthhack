ALTER TABLE "User" ADD COLUMN "username" CITEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "UserProfile"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "middleName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "passoutDate" DATE,
  ADD COLUMN "studyYear" INTEGER,
  ADD COLUMN "discipline" TEXT,
  ADD COLUMN "skillExpertise" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "registrationCompletedAt" TIMESTAMP(3);
