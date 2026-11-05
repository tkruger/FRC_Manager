// People's names: we ask for a real first and last name (not a nickname or a Discord username), so
// the team knows who everyone is. Client-safe.

import { z } from "zod";

export const FULL_NAME_HINT = "Your real first and last name, so your team knows who you are.";
export const FULL_NAME_ERROR = "Enter your first and last name.";

/** At least two words with letters in them ("Dana Starler", "José Núñez"; not "dana" or "xX_gamer_Xx") */
export function looksLikeFullName(name: string): boolean {
  return name.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w)).length >= 2;
}

export const fullNameSchema = z.string().trim()
  .min(2, FULL_NAME_ERROR)
  .max(100, "That name is too long.")
  .refine(looksLikeFullName, FULL_NAME_ERROR);

/** For comparing names: lowercase, single spaces, no accents */
export const nameKey = (n: string) => n.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** "Alex Starler, Jamie & Sam Lee and Kim" → each name */
export function splitNames(text: string): string[] {
  return text.split(/[,;\n/&+]|\band\b/i).map((n) => n.trim()).filter((n) => /\p{L}/u.test(n)).slice(0, 10);
}
