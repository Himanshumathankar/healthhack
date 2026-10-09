import { describe, expect, it } from "vitest";
import { generateOpaqueToken, hashToken } from "./tokens.js";

describe("tokens", () => {
  it("generates URL-safe opaque tokens", () => {
    const token = generateOpaqueToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes tokens deterministically without returning the token", () => {
    const token = "secret-token";
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});
