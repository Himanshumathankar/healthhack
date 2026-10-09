CREATE TABLE "Submission" (
 "id" UUID PRIMARY KEY, "teamId" UUID NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
 "title" TEXT NOT NULL, "summary" TEXT NOT NULL, "repositoryUrl" TEXT, "demoUrl" TEXT,
 "status" TEXT NOT NULL DEFAULT 'SUBMITTED', "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Submission_teamId_idx" ON "Submission"("teamId");
CREATE TABLE "SubmissionReview" (
 "id" UUID PRIMARY KEY, "submissionId" UUID NOT NULL REFERENCES "Submission"("id") ON DELETE CASCADE,
 "reviewerId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
 "score" INTEGER NOT NULL CHECK ("score" BETWEEN 0 AND 100), "feedback" TEXT NOT NULL,
 "published" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "SubmissionReview_submissionId_reviewerId_key" ON "SubmissionReview"("submissionId", "reviewerId");
