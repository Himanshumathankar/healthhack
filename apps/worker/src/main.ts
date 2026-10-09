import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { createLogger } from "@healthhack/logger";

const logger = createLogger("healthhack-worker");
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

const worker = new Worker(
  "healthhack",
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "processing job");
    await Promise.resolve();
  },
  { connection }
);

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "job failed");
});
