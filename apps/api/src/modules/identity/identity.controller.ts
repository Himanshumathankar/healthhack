import { Body, Controller, Post } from "@nestjs/common";
import { registerSchema } from "@healthhack/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import argon2 from "argon2";
import crypto from "node:crypto";

@Controller("identity")
export class IdentityController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("register")
  async register(@Body() body: unknown) {
    const input = registerSchema.parse(body);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        profile: {
          create: {
            fullName: input.fullName,
            skills: []
          }
        },
        emailTokens: {
          create: {
            tokenHash,
            expiresAt
          }
        }
      },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        profile: {
          select: {
            fullName: true
          }
        }
      }
    });

    return {
      user,
      verificationToken: process.env.NODE_ENV === "production" ? undefined : token
    };
  }
}
