BEGIN;
CREATE TABLE "OrganizationRole" (
 "id" UUID PRIMARY KEY, "name" CITEXT NOT NULL UNIQUE, "builtInKey" TEXT UNIQUE, "description" TEXT,
 "initialized" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "User" ADD COLUMN "organizationRoleId" UUID REFERENCES "OrganizationRole"("id") ON DELETE RESTRICT,
 ADD COLUMN "suspendedAt" TIMESTAMP(3), ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "lastSignInAt" TIMESTAMP(3);
UPDATE "User" AS account SET "lastSignInAt" = signed.last_sign_in FROM (SELECT "userId", MAX("createdAt") AS last_sign_in FROM "UserSession" GROUP BY "userId") AS signed WHERE account."id" = signed."userId";
CREATE TABLE "OrganizationRolePermission" (
 "roleId" UUID NOT NULL REFERENCES "OrganizationRole"("id") ON DELETE CASCADE,
 "permissionId" UUID NOT NULL REFERENCES "Permission"("id") ON DELETE CASCADE, PRIMARY KEY ("roleId", "permissionId")
);
CREATE TABLE "Announcement" (
 "id" UUID PRIMARY KEY, "authorId" UUID REFERENCES "User"("id") ON DELETE SET NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL,
 "published" BOOLEAN NOT NULL DEFAULT false, "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Announcement_published_publishedAt_idx" ON "Announcement"("published", "publishedAt");
CREATE TABLE "OrganizationService" (
 "id" UUID PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "SupportTicket" (
 "id" UUID PRIMARY KEY, "subject" TEXT NOT NULL, "message" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN', "assignedTo" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
COMMIT;
