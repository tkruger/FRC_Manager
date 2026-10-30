// One first-visit prompt at a time (turn on notifications, add to home screen). Client-only.
//
// Without this, both dialogs opened together: the second sat on top of the first, and
// dismissing it closed both. A prompt asks for its turn with whenFree(); the next one waits
// until it's released, then opens after a short pause.

let active: string | null = null;
const waiting: { name: string; show: () => void }[] = [];

/** Show `name` now if no other prompt is up, otherwise once the current one closes */
export function whenFree(name: string, show: () => void): void {
  if (active === null || active === name) {
    active = name;
    show();
  } else if (!waiting.some((w) => w.name === name)) {
    waiting.push({ name, show });
  }
}

/** `name` closed (or won't show after all): let the next prompt have its turn */
export function releasePrompt(name: string): void {
  const queued = waiting.findIndex((w) => w.name === name);
  if (queued >= 0) waiting.splice(queued, 1);
  if (active !== name) return;
  active = null;
  const next = waiting.shift();
  if (next) setTimeout(() => whenFree(next.name, next.show), 800);
}
