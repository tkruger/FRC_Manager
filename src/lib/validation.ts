// Readable validation errors for server actions.
//
// Zod's built-in messages come from its English locale, which it installs as an import
// side effect — and the production bundle can drop it, leaving every built-in message as a
// bare "Invalid input". So: install it explicitly here, and build our own message from the
// issue (which field, what's wrong) so it reads well whatever the locale.

import { z } from "zod";

z.config(z.locales.en());

type Issue = z.core.$ZodIssue;

/** "unitCost" → "Unit cost" */
function humanize(key: PropertyKey | undefined): string {
  if (key == null || typeof key === "number") return "This field";
  const s = String(key).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Zod's own wording (or the bare fallback) — replaced with ours; anything else is a custom message */
const BUILT_IN = /^(Invalid input|Invalid option|Invalid (string|number|value|key|element|discriminator)|Too (big|small)|Expected |Unrecognized key)/;

function describe(issue: Issue, name: string): string {
  const n = (v: unknown) => (typeof v === "bigint" || typeof v === "number" ? Number(v).toLocaleString("en-US") : String(v));
  switch (issue.code) {
    case "too_big":
      if (issue.origin === "string") return `${name} is too long — ${n(issue.maximum)} characters at most.`;
      if (issue.origin === "array" || issue.origin === "set") return `${name} has too many entries — ${n(issue.maximum)} at most.`;
      return `${name} can be at most ${n(issue.maximum)}.`;
    case "too_small":
      if (issue.origin === "string") return Number(issue.minimum) <= 1 ? `${name} is required.` : `${name} needs at least ${n(issue.minimum)} characters.`;
      if (issue.origin === "array" || issue.origin === "set") return `${name} needs at least ${n(issue.minimum)}.`;
      return issue.inclusive === false ? `${name} must be more than ${n(issue.minimum)}.` : `${name} must be at least ${n(issue.minimum)}.`;
    case "invalid_type":
      // (Zod doesn't keep the value it got, so a missing field and a wrong one look alike)
      if (issue.expected === "number" || issue.expected === "int" || issue.expected === "bigint") return `${name} must be a number.`;
      return issue.input === undefined ? `${name} is required.` : `${name} isn't valid.`;
    case "invalid_value":
      return `${name} isn't one of the choices.`;
    case "invalid_format":
      return issue.format === "url" ? `${name} must be a full link (https://…).`
        : issue.format === "email" ? `${name} must be an email address.`
        : `${name} isn't in the right format.`;
    default:
      return `${name} isn't valid.`;
  }
}

/**
 * The first problem in a failed parse, as a sentence for the person filling in the form.
 * `label` names a field from its path (e.g. "Item 2: Link"); without one the last key is used.
 * Custom messages from the schema ("Give the order a name.") are kept as they are.
 */
export function issueMessage(error: z.ZodError, label?: (path: PropertyKey[]) => string | null): string {
  const issue = error.issues[0];
  if (!issue) return "Please check the form.";
  const name = label?.(issue.path) ?? humanize(issue.path[issue.path.length - 1]);
  if (issue.message && !BUILT_IN.test(issue.message)) {
    // A custom message; on a nested field, say where it is
    return label && issue.path.length > 1 ? `${name.replace(/: [^:]+$/, "")}: ${issue.message}` : issue.message;
  }
  return describe(issue, name);
}
