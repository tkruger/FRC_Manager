// Encrypting secrets we must be able to read back (a team's mail server password). Server-only.
//
// AES-256-GCM with a key derived from EMAIL_CONFIG_KEY, or AUTH_SECRET when that isn't set.
// Changing the key makes stored secrets unreadable — teams then re-enter their password.

import crypto from "crypto";

function key(): Buffer {
  const secret = process.env.EMAIL_CONFIG_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Set AUTH_SECRET (or EMAIL_CONFIG_KEY) to store email server passwords.");
  return Buffer.from(crypto.hkdfSync("sha256", secret, "frc-manager", "team-email-server", 32));
}

/** "v1:" + base64(iv | tag | ciphertext) */
export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return "v1:" + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

/** The secret, or null if it can't be read (wrong key, damaged) */
export function open(sealed: string): string | null {
  try {
    if (!sealed.startsWith("v1:")) return null;
    const raw = Buffer.from(sealed.slice(3), "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
