import { describe, expect, it } from "vitest";
import { formatTeamCode } from "./team-code.js";

describe("formatTeamCode", () => {
  it("builds human-readable team codes from event slugs", () => {
    expect(formatTeamCode("healthhack-2027", 42)).toBe("H2-T-00042");
  });

  it("falls back for slugs without alphanumeric initials", () => {
    expect(formatTeamCode("---", 7)).toBe("EVT-T-00007");
  });
});
