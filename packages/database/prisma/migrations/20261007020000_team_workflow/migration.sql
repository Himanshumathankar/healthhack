BEGIN;
CREATE SEQUENCE team_id_serial;
CREATE FUNCTION generate_team_id() RETURNS TEXT LANGUAGE SQL VOLATILE AS $$
  SELECT 'HH-VITB-JHU-' || EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::TEXT || '-' || LPAD(nextval('team_id_serial')::TEXT, 5, '0');
$$;
ALTER TABLE "Team" ADD COLUMN "joinCode" TEXT;
CREATE UNIQUE INDEX "Team_joinCode_key" ON "Team"("joinCode");
CREATE FUNCTION generate_team_join_code() RETURNS TEXT LANGUAGE plpgsql VOLATILE AS $$
DECLARE candidate TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(726104702);
  LOOP
    candidate := (1000000000 + FLOOR(RANDOM() * 9000000000))::BIGINT::TEXT;
    IF NOT EXISTS (SELECT 1 FROM "Team" WHERE "joinCode" = candidate) THEN RETURN candidate; END IF;
  END LOOP;
END;
$$;
DO $$
DECLARE existing RECORD;
BEGIN
  FOR existing IN SELECT "id" FROM "Team" ORDER BY "createdAt", "id" LOOP
    UPDATE "Team" SET "teamCode" = generate_team_id(), "joinCode" = generate_team_join_code() WHERE "id" = existing."id";
  END LOOP;
END;
$$;
UPDATE "Team" SET "name" = TRIM(REGEXP_REPLACE(REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g'), '^(team([\s_-]+|$))+', '', 'i'));
ALTER TABLE "Team" ALTER COLUMN "name" TYPE CITEXT;
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
CREATE UNIQUE INDEX "Team_teamCode_key" ON "Team"("teamCode");
ALTER TABLE "Team" ALTER COLUMN "teamCode" SET DEFAULT generate_team_id();
ALTER TABLE "Team" ALTER COLUMN "joinCode" SET DEFAULT generate_team_join_code();
ALTER TABLE "Team" ALTER COLUMN "joinCode" SET NOT NULL;
ALTER TABLE "Team" ADD CONSTRAINT "Team_joinCode_format" CHECK ("joinCode" ~ '^[0-9]{10}$');
CREATE UNIQUE INDEX "TeamMember_userId_key" ON "TeamMember"("userId");
CREATE TABLE "TeamJoinRequest" (
  "id" UUID NOT NULL, "teamId" UUID NOT NULL, "userId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, PRIMARY KEY ("id"),
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "TeamJoinRequest_status" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);
CREATE UNIQUE INDEX "TeamJoinRequest_teamId_userId_key" ON "TeamJoinRequest"("teamId", "userId");
CREATE INDEX "TeamJoinRequest_teamId_status_idx" ON "TeamJoinRequest"("teamId", "status");
COMMIT;
