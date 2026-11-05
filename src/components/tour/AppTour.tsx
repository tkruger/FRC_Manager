"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { releasePrompt, whenFree } from "@/lib/prompt-queue";
import { markTourSeenAction } from "@/app/actions/tour";
import type { LucideIcon } from "lucide-react";
import { AUDIENCE_LABEL, FRC_PRIMER, WELCOME_ICON, tourSteps, type TourAudience, type TourStep } from "./tour-steps";

// The app tour: a card for each step, pointing at the part of the screen it's about (a spotlight
// cut out of a dimmed page). Offered once, on Home, to everyone who hasn't seen it (it goes before
// the other first-visit prompts); "Take the tour" in the profile menu runs it again.

const START_EVENT = "frc:start-tour";
export const startTour = () => window.dispatchEvent(new Event(START_EVENT));

/** The first element for any of these data-tour names that's actually on the screen */
function findTarget(names: string[] | undefined): HTMLElement | null {
  for (const name of names ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
    }
  }
  return null;
}

/**
 * Bring a target into view by scrolling the page's own scroller only — never scrollIntoView, which
 * also nudges iOS's viewport (and the tab bar with it). Fixed things (the bars) are already on screen.
 */
function scrollToShow(el: HTMLElement) {
  for (let p: HTMLElement | null = el; p; p = p.parentElement) {
    if (getComputedStyle(p).position === "fixed" && p.tagName !== "MAIN") return;
  }
  const scroller = document.documentElement.classList.contains("standalone")
    ? document.querySelector<HTMLElement>("#app-shell > main")
    : null;
  const r = el.getBoundingClientRect();
  const delta = r.top + r.height / 2 - window.innerHeight / 2;
  if (Math.abs(delta) < 40) return;
  if (scroller) scroller.scrollBy({ top: delta, behavior: "smooth" });
  else window.scrollBy({ top: delta, behavior: "smooth" });
}

const PAD = 6;
const GAP = 14;

export function AppTour({ audience, offer }: { audience: TourAudience; offer: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const open = steps !== null;
  const step = steps?.[index] ?? null;
  // A welcome card first; the FRC primer is added if they pick it there
  const welcome = useCallback((): TourStep => ({ id: "welcome", title: "Welcome to FRC Manager", body: null }), []);

  const begin = useCallback(() => { setIndex(0); setSteps([welcome()]); }, [welcome]);

  const finish = useCallback(() => {
    setSteps(null);
    setCardPos(null);
    releasePrompt("tour");
    markTourSeenAction().catch(() => {});
  }, []);

  // Offered once, on Home — before the notification / home-screen prompts
  useEffect(() => {
    if (!offer || pathname !== "/dashboard") return;
    const t = setTimeout(() => whenFree("tour", begin), 700);
    return () => clearTimeout(t);
  }, [offer, pathname, begin]);

  // "Take the tour" (profile menu, Help) — on Home, where every part of it is
  useEffect(() => {
    const go = () => (pathname === "/dashboard" ? begin() : router.push("/dashboard?tour=1"));
    window.addEventListener(START_EVENT, go);
    return () => window.removeEventListener(START_EVENT, go);
  }, [pathname, router, begin]);
  useEffect(() => {
    if (params.get("tour") !== "1" || pathname !== "/dashboard") return;
    router.replace("/dashboard", { scroll: false });
    const t = setTimeout(begin, 500);
    return () => clearTimeout(t);
  }, [params, pathname, router, begin]);

  // Where this step's target is on the screen
  const measure = useCallback(() => {
    if (!step) return;
    if (!step.target) { setRect(null); return; }
    const el = findTarget(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // Bring the target into view, then measure (again once any scrolling has settled)
  useEffect(() => {
    const el = findTarget(step?.target);
    if (el) scrollToShow(el);
    const now = setTimeout(measure, 0);
    const settled = setTimeout(measure, 380);
    return () => { clearTimeout(now); clearTimeout(settled); };
  }, [step, measure]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open, measure]);

  // Place the card next to the spotlight, where it fits; otherwise in the middle
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !open) return;
    const w = card.offsetWidth, h = card.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    if (!rect) { setCardPos({ top: Math.max(12, (vh - h) / 2), left: Math.max(12, (vw - w) / 2) }); return; }
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), vw - w - 12);
    const below = rect.bottom + PAD + GAP;
    const above = rect.top - PAD - GAP - h;
    // Below or above if it fits; otherwise pinned to whichever edge has more room, covering as little as possible
    const top = below + h < vh - 12 ? below : above > 12 ? above
      : rect.top > vh - rect.bottom ? 12 : Math.max(12, vh - h - 12);
    setCardPos({ top, left });
  }, [rect, open, index, steps]);

  // Keyboard: Esc ends it, arrows step through
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" && index > 0) next();
      if (e.key === "ArrowLeft" && index > 1) setIndex((i) => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => { if (open) cardRef.current?.focus(); }, [open, index]);

  if (!open || !step) return null;
  // The highlight, kept inside the screen so all of its border shows (the bottom bar sits at the edge)
  const spot = rect && (() => {
    const top = Math.max(4, rect.top - PAD), left = Math.max(4, rect.left - PAD);
    const bottom = Math.min(window.innerHeight - 4, rect.bottom + PAD), right = Math.min(window.innerWidth - 4, rect.right + PAD);
    return { top, left, width: right - left, height: bottom - top };
  })();
  const tour = tourSteps(audience);
  const last = index === steps.length - 1;
  function next() { if (last) finish(); else setIndex((i) => i + 1); }
  // Steps about things that aren't on this screen are left out (Home's tiles elsewhere, More on a computer)
  const startTourSteps = (withPrimer: boolean) => {
    const shown = tour.filter((s) => !s.target || findTarget(s.target));
    setSteps([welcome(), ...(withPrimer ? FRC_PRIMER : []), ...shown]);
    setIndex(1);
  };
  const newcomerFirst = audience === "parent" || audience === "student";

  return (
    <div className="tour-anim fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* The dimmed page, with a window cut around the target — a bright double border (white outside,
          the theme color inside) and a glow, so it stands out in dark mode too */}
      {spot ? (
        <>
          <div data-tour-spot className="pointer-events-none fixed rounded-xl transition-all duration-300 ease-out"
            style={{
              ...spot,
              boxShadow: [
                "0 0 0 3px var(--color-primary)",
                "0 0 0 6px rgba(255,255,255,0.92)",
                "0 0 28px 8px color-mix(in srgb, var(--color-primary) 60%, transparent)",
                "0 0 0 9999px rgba(0,0,0,0.68)",
              ].join(", "),
            }} />
          {/* A ring that pulses outward from it */}
          <div key={step.id} className="tour-pulse pointer-events-none fixed rounded-xl border-2 border-white"
            style={{ top: spot.top - 6, left: spot.left - 6, width: spot.width + 12, height: spot.height + 12 }} />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/65 transition-opacity duration-300" />
      )}
      {/* Clicks outside the card don't reach the page */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div ref={cardRef} tabIndex={-1}
        className={`fixed w-[min(380px,calc(100vw-24px))] rounded-2xl border border-(--color-border) p-5 text-sm leading-relaxed text-(--color-text-primary) shadow-2xl outline-none ${index > 0 ? "transition-[top,left] duration-300 ease-out" : ""}`}
        // Hidden until it has been placed (it doesn't fly in from off-screen); then it glides between steps
        style={{ backgroundColor: "var(--color-surface)", top: cardPos?.top ?? 0, left: cardPos?.left ?? 0, opacity: cardPos ? 1 : 0 }}>
        {/* Each step's content slides in */}
        <div key={step.id} className="tour-card-in">
          {step.id === "welcome" ? (
            <>
              <Badge icon={WELCOME_ICON} tint={["#F97316", "#0D9488"]} motion="bob" />
              <h2 id="tour-title" className="mt-3 text-h3 text-(--color-text-primary)">Welcome to FRC Manager 👋</h2>
              <p className="mt-2">A one-minute tour for {AUDIENCE_LABEL[audience]}: where things are, and what you can do here.</p>
              <p className="mt-2 text-(--color-text-secondary)">New to FRC robotics? Start with four quick cards on how it all works.</p>
              <div className="mt-4 flex flex-col gap-2">
                {newcomerFirst && <Button onClick={() => startTourSteps(true)}>I&apos;m new to FRC — start with the basics</Button>}
                <Button variant={newcomerFirst ? "outline" : "primary"} onClick={() => startTourSteps(false)}>Show me around</Button>
                {!newcomerFirst && <Button variant="outline" onClick={() => startTourSteps(true)}>Start with FRC basics</Button>}
                <button type="button" onClick={finish} className="mt-1 text-small text-(--color-text-secondary) hover:underline">Not now</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {step.icon && <Badge icon={step.icon} tint={step.tint} motion={step.motion} burst={last} />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">{index} of {steps.length - 1}</p>
                  <h2 id="tour-title" className="text-h3 text-(--color-text-primary)">{step.title}</h2>
                </div>
              </div>
              <div className="mt-3">{step.body}</div>
              {/* Progress */}
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-(--color-surface-overlay)" aria-hidden>
                <div className="h-full rounded-full bg-(--color-primary) transition-[width] duration-500 ease-out" style={{ width: `${(index / (steps.length - 1)) * 100}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button type="button" onClick={finish} className="text-small text-(--color-text-secondary) hover:underline">{last ? "" : "Skip tour"}</button>
                <div className="flex gap-2">
                  {index > 1 && <Button size="sm" variant="outline" onClick={() => setIndex((i) => i - 1)}>Back</Button>}
                  <Button size="sm" onClick={next}>{last ? "Done" : "Next"}</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The colored picture at the top of a card (with a little burst on the last one) */
function Badge({ icon: Icon, tint = ["#8B5CF6", "#6366F1"], motion, burst }: {
  icon: LucideIcon; tint?: [string, string]; motion?: "bob" | "swing"; burst?: boolean;
}) {
  return (
    <span className="tour-pop relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
      style={{ backgroundImage: `linear-gradient(135deg, ${tint[0]}, ${tint[1]})` }}>
      <Icon className={`h-6 w-6 ${motion === "bob" ? "tour-bob" : motion === "swing" ? "tour-swing" : ""}`} strokeWidth={2} aria-hidden />
      {burst && BURST.map(([dx, dy, c], i) => (
        <span key={i} className="tour-burst absolute left-1/2 top-1/2 h-2 w-2 rounded-sm"
          style={{ backgroundColor: c, animationDelay: `${i * 40}ms`, ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px` }} aria-hidden />
      ))}
    </span>
  );
}

const BURST: [number, number, string][] = [
  [-34, -30, "#F97316"], [32, -34, "#0D9488"], [40, 4, "#EAB308"], [-40, 8, "#EC4899"],
  [-22, 34, "#3B82F6"], [24, 32, "#22C55E"], [0, -42, "#A855F7"], [4, 40, "#EF4444"],
];
