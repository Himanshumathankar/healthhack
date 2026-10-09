import { describe, expect, it } from "vitest";
import {
  acceptInviteSchema,
  createTeamSchema,
  educationSchema,
  loginSchema,
  registerSchema,
  skillsSchema,
  usernameSchema,
  teamNameSchema,
  joinTeamSchema,
} from "./index.js";

describe("contracts", () => {
  it("normalizes team names without a Team prefix", () => {
    expect(teamNameSchema.parse(" Team ALFA ")).toBe("ALFA");
    expect(teamNameSchema.parse("TEAM team alfa")).toBe("alfa");
    expect(teamNameSchema.safeParse("Team").success).toBe(false);
    expect(joinTeamSchema.safeParse({ code: "1234567890" }).success).toBe(true);
    expect(joinTeamSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(joinTeamSchema.safeParse({ code: "123456789a" }).success).toBe(
      false,
    );
  });
  const account = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    username: "Ada_123",
    password: "Unique!Code2027",
    confirmPassword: "Unique!Code2027",
  };
  it("normalizes username case and preserves name fields", () => {
    expect(registerSchema.parse(account).username).toBe("ada_123");
    expect(usernameSchema.parse("ADA_123")).toBe(
      usernameSchema.parse("ada_123"),
    );
  });
  it("rejects weak passwords and mismatched confirmation", () => {
    for (const password of [
      "alllowercase123!",
      "ALLUPPERCASE123!",
      "NoNumbersHere!",
      "NoSymbols12345",
      "Password12345!",
    ]) {
      expect(
        registerSchema.safeParse({
          ...account,
          password,
          confirmPassword: password,
        }).success,
      ).toBe(false);
    }
    expect(
      registerSchema.safeParse({ ...account, confirmPassword: "different" })
        .success,
    ).toBe(false);
  });
  it("rejects invalid education dates and duplicate skills", () => {
    expect(
      educationSchema.safeParse({
        college: "Example College",
        passoutDate: "2027-02-30",
        studyYear: 3,
        branch: "Computing",
        discipline: "Engineering",
      }).success,
    ).toBe(false);
    expect(
      skillsSchema.safeParse({
        skills: [
          { name: "Python", expertise: "EXPERT" },
          { name: "python", expertise: "BEGINNER" },
        ],
      }).success,
    ).toBe(false);
    expect(skillsSchema.safeParse({ skills: [] }).success).toBe(false);
  });
  it("requires strong registration password length", () => {
    expect(() =>
      registerSchema.parse({
        ...account,
        password: "short",
        confirmPassword: "short",
      }),
    ).toThrow();
  });

  it("accepts valid login payloads", () => {
    expect(
      loginSchema.parse({ email: "user@example.com", password: "anything" }),
    ).toEqual({
      email: "user@example.com",
      password: "anything",
    });
  });

  it("validates team creation shape", () => {
    expect(() =>
      createTeamSchema.parse({ eventId: "not-a-uuid", name: "Care Team" }),
    ).toThrow();
  });

  it("requires opaque invite tokens", () => {
    expect(() => acceptInviteSchema.parse({ token: "tiny" })).toThrow();
  });
});
