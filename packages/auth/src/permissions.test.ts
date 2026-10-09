import { describe, expect, it } from "vitest";
import { hasPermission, permissions } from "./permissions.js";

describe("permissions", () => {
  it("keeps canonical event permissions available", () => {
    expect(permissions).toContain("teams.read");
    expect(permissions).toContain("audit.read");
  });

  it("checks granted permission sets", () => {
    expect(hasPermission(["teams.read"], "teams.read")).toBe(true);
    expect(hasPermission(["teams.read"], "audit.read")).toBe(false);
  });
});
