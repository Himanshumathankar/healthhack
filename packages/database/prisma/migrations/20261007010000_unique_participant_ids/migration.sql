BEGIN;

ALTER TABLE "User" ADD COLUMN "participantId" TEXT;
CREATE UNIQUE INDEX "User_participantId_key" ON "User"("participantId");

CREATE FUNCTION generate_participant_id(id_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::INTEGER)
RETURNS TEXT LANGUAGE plpgsql VOLATILE AS $$
DECLARE candidate TEXT;
BEGIN
  -- Serialize allocation so concurrent accounts cannot claim the same candidate.
  PERFORM pg_advisory_xact_lock(726104701);
  LOOP
    candidate := id_year::TEXT || '-' || (10000000 + FLOOR(RANDOM() * 90000000))::BIGINT::TEXT;
    IF NOT EXISTS (SELECT 1 FROM "User" WHERE "participantId" = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE account RECORD;
BEGIN
  FOR account IN SELECT "id", "createdAt" FROM "User" WHERE "participantId" IS NULL LOOP
    UPDATE "User"
      SET "participantId" = generate_participant_id(EXTRACT(YEAR FROM (account."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::INTEGER)
      WHERE "id" = account."id";
  END LOOP;
END;
$$;

ALTER TABLE "User" ALTER COLUMN "participantId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "participantId" SET DEFAULT generate_participant_id();
ALTER TABLE "User" ADD CONSTRAINT "User_participantId_format" CHECK ("participantId" ~ '^[0-9]{4}-[0-9]{8}$');

UPDATE "Participant" AS participant
SET "participantCode" = account."participantId"
FROM "User" AS account
WHERE participant."userId" = account."id";

COMMIT;
