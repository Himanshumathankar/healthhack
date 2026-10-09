import crypto from "node:crypto";

export function generateOpaqueToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
