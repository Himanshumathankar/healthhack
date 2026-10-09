import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { createLogger } from "@healthhack/logger";
import { PrismaClient } from "@healthhack/database";
import { createSmtpEmailProvider } from "@healthhack/email";

const logger = createLogger("healthhack-worker");
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});
const prisma = new PrismaClient();
const emailProvider = createSmtpEmailProvider({
  host: process.env.MAILPIT_SMTP_HOST ?? "localhost",
  port: process.env.MAILPIT_SMTP_PORT ? Number(process.env.MAILPIT_SMTP_PORT) : 1025
});

const worker = new Worker(
  "healthhack",
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "processing job");

    if (job.name === "email.send") {
      const data = job.data as { emailMessageId?: string };
      if (!data.emailMessageId) {
        throw new Error("email.send job missing emailMessageId");
      }

      await sendEmailMessage(data.emailMessageId);
      return;
    }

    logger.warn({ jobId: job.id, name: job.name }, "unknown job name");
  },
  { connection }
);

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "job failed");
});

async function sendEmailMessage(emailMessageId: string) {
  const claimed = await prisma.emailMessage.updateMany({
    where: {
      id: emailMessageId,
      status: {
        in: ["QUEUED", "FAILED"]
      }
    },
    data: {
      status: "SENDING",
      error: null
    }
  });

  if (claimed.count === 0) {
    logger.info({ emailMessageId }, "email already processed or being processed");
    return;
  }

  const email = await prisma.emailMessage.findUniqueOrThrow({
    where: { id: emailMessageId }
  });

  try {
    const result = await emailProvider.send({
      from: process.env.EMAIL_FROM ?? "HealthHack <noreply@healthhack.local>",
      to: email.toEmail,
      subject: email.subject,
      html: email.htmlBody,
      text: email.textBody
    });

    await prisma.emailMessage.update({
      where: { id: email.id },
      data: {
        status: "SENT",
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
        error: null
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown email delivery error";
    await prisma.emailMessage.update({
      where: { id: email.id },
      data: {
        status: "FAILED",
        error: message
      }
    });
    throw error;
  }
}

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  await Promise.allSettled([worker.close(), connection.quit(), prisma.$disconnect()]);
}

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
