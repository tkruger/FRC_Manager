// Errors that are safe to show people. Anything else (database, network, bugs) is logged
// and replaced with a generic message, so internals never reach the browser.

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export function userMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ActionError) return e.message;
  console.error("[action]", e);
  return fallback;
}
