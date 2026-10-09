import { z } from "zod";

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  emailVerifiedAt: z.string().datetime().nullable(),
  profile: z
    .object({
      fullName: z.string(),
      participantCode: z.string().nullable()
    })
    .nullable()
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  fullName: z.string().min(2).max(160)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const createTeamSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(2).max(120),
  trackId: z.string().uuid().optional(),
  problemStatementId: z.string().uuid().optional()
});

export type PublicUser = z.infer<typeof publicUserSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
