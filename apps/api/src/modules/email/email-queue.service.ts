import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { PrismaService } from "../prisma/prisma.service.js";

type QueueEmailInput = {
  eventId?: string | undefined;
  recipientUserId?: string | undefined;
  toEmail: string;
  templateKey: string;
  subject: string;
  htmlBody: string;
  textBody: string;
};

@Injectable()
export class EmailQueueService implements OnModuleDestroy {
  private readonly connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null
  });

  private readonly queue = new Queue("healthhack", {
    connection: this.connection
  });

  constructor(private readonly prisma: PrismaService) {}

  async queueEmail(input: QueueEmailInput) {
    const email = await this.prisma.emailMessage.create({
      data: {
        eventId: input.eventId ?? null,
        recipientUserId: input.recipientUserId ?? null,
        toEmail: input.toEmail.toLowerCase(),
        templateKey: input.templateKey,
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody
      }
    });

    await this.queue.add(
      "email.send",
      { emailMessageId: email.id },
      {
        jobId: `email-send-${email.id}`,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000
        },
        removeOnComplete: {
          age: 60 * 60 * 24,
          count: 1000
        },
        removeOnFail: {
          age: 60 * 60 * 24 * 7
        }
      }
    );

    return email;
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}
