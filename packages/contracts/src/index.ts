import { z } from "zod";

export const organizationModules = [
  { key: "dashboard", name: "Home", actions: ["read"] },
  {
    key: "teams",
    name: "Teams",
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "members.manage",
      "invitations.manage",
    ],
  },
  {
    key: "submissions",
    name: "Submissions",
    actions: ["read", "create", "update", "delete", "export"],
  },
  {
    key: "reviews",
    name: "Reviews",
    actions: ["read", "assign", "score", "publish"],
  },
  {
    key: "services",
    name: "Services",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "users",
    name: "Users",
    actions: ["read", "roles.assign", "suspend", "delete", "password.reset"],
  },
  {
    key: "roles",
    name: "Roles",
    actions: ["read", "create", "update", "delete", "permissions.update"],
  },
  {
    key: "announcements",
    name: "Announcements",
    actions: ["read", "create", "update", "delete", "publish"],
  },
  {
    key: "support",
    name: "Support",
    actions: ["read", "create", "update", "delete", "assign", "resolve"],
  },
  { key: "sessions", name: "Sessions", actions: ["read", "revoke"] },
  { key: "audit", name: "Audit log", actions: ["read"] },
] as const;
export const organizationPermissions = organizationModules.flatMap((module) =>
  module.actions.map((action) => ({
    key: `org.${module.key}.${action}`,
    module: module.name,
    action,
    superAdminOnly:
      (module.key === "users" && action === "roles.assign") ||
      (module.key === "roles" && action === "permissions.update"),
  })),
);
export const builtInOrganizationRoles = [
  {
    key: "SUPER_ADMIN",
    name: "Super admin",
    grants: organizationPermissions.map((permission) => permission.key),
  },
  {
    key: "COORDINATOR",
    name: "Coordinators",
    grants: [
      "org.dashboard.read",
      "org.teams.read",
      "org.teams.update",
      "org.users.read",
      "org.announcements.read",
      "org.announcements.create",
      "org.announcements.publish",
      "org.services.read",
      "org.services.create",
      "org.services.update",
      "org.submissions.read",
      "org.reviews.read",
      "org.support.read",
      "org.support.update",
    ],
  },
  {
    key: "FACULTY",
    name: "Faculty",
    grants: [
      "org.dashboard.read",
      "org.teams.read",
      "org.submissions.read",
      "org.reviews.read",
      "org.announcements.read",
    ],
  },
  {
    key: "REVIEWER",
    name: "Reviewer",
    grants: [
      "org.dashboard.read",
      "org.teams.read",
      "org.submissions.read",
      "org.reviews.read",
      "org.reviews.score",
      "org.announcements.read",
    ],
  },
  {
    key: "VOLUNTEER",
    name: "Volunteers",
    grants: [
      "org.dashboard.read",
      "org.services.read",
      "org.support.read",
      "org.announcements.read",
    ],
  },
  {
    key: "SUPPORT",
    name: "Support team",
    grants: [
      "org.dashboard.read",
      "org.support.read",
      "org.support.create",
      "org.support.update",
      "org.support.assign",
      "org.support.resolve",
      "org.users.read",
      "org.announcements.read",
    ],
  },
  {
    key: "GUEST",
    name: "Guest",
    grants: ["org.dashboard.read", "org.announcements.read"],
  },
];

export const adminRoleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(""),
});
export const adminRolePermissionsSchema = z.object({
  permissions: z.array(z.string()).max(200),
  password: z.string().min(1),
});
export const adminUserRoleSchema = z.object({
  roleId: z.string().uuid().nullable(),
  password: z.string().min(1),
});
export const adminUserActionSchema = z.object({
  action: z.enum(["suspend", "restore", "delete", "reset-password"]),
  password: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});
export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(10000),
  published: z.boolean().default(false),
});

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  emailVerifiedAt: z.string().datetime().nullable(),
  profile: z
    .object({
      fullName: z.string(),
      participantCode: z.string().nullable(),
    })
    .nullable(),
});

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.")
  .regex(/[^a-zA-Z0-9]/, "Include a special character.")
  .refine(
    (value) => !/^(password|qwerty|letmein|welcome|123456)/i.test(value),
    "Choose a less predictable password.",
  );

export const registerSchema = z
  .object({
    email: z.string().email(),
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    firstName: z.string().trim().min(1).max(60),
    middleName: z.string().trim().max(60).default(""),
    lastName: z.string().trim().min(1).max(60),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const educationSchema = z.object({
  college: z.string().trim().min(2).max(200),
  passoutDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(value);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Enter a valid date."),
  studyYear: z.number().int().min(1).max(8),
  branch: z.string().trim().min(2).max(120),
  discipline: z.string().trim().min(2).max(120),
});

export const skillsSchema = z
  .object({
    skills: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          expertise: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
        }),
      )
      .min(1)
      .max(30),
  })
  .refine(
    (value) =>
      new Set(value.skills.map((skill) => skill.name.toLowerCase())).size ===
      value.skills.length,
    "Each skill must be unique.",
  );

export const loginSchema = z.union([
  z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  z.object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1),
  }),
]);

export const verifyEmailSchema = z.object({
  token: z.string().min(32),
});
export const resetPasswordSchema = z
  .object({
    token: z.string().min(32),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(160).optional(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(32),
});

export const teamNameSchema = z
  .string()
  .trim()
  .transform((name) =>
    name
      .replace(/\s+/g, " ")
      .replace(/^(?:team(?:[\s_-]+|$))+/i, "")
      .trim(),
  )
  .pipe(
    z.string().min(2, "Enter the team name without the word Team.").max(120),
  );
export const joinTeamSchema = z.union([
  z.object({
    code: z.string().regex(/^\d{10}$/, "Enter a 10-digit team code."),
  }),
  z.object({ teamId: z.string().uuid() }),
]);
export const teammateVisibilitySchema = z
  .object({ enabled: z.boolean(), consent: z.boolean().optional() })
  .refine(
    (value) => !value.enabled || value.consent === true,
    "Confirm profile sharing before enabling teammate discovery.",
  );
export const createTeamSchema = z.object({
  eventId: z.string().uuid().optional(),
  name: teamNameSchema,
  trackId: z.string().uuid().optional(),
  problemStatementId: z.string().uuid().optional(),
});
export const adminTeamUpdateSchema = z.object({
  name: teamNameSchema,
  description: z.string().trim().max(2000).optional(),
  requiresMembers: z.boolean().optional(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;
export const adminTeamCreateSchema = adminTeamUpdateSchema.extend({
  leaderParticipantId: z
    .string()
    .regex(/^\d{4}-\d{8}$/, "Enter the team leader's participant ID."),
});
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
