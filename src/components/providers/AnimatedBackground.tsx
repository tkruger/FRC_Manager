"use client";

// Ambient CSS-animated orbs only — no mouse tracking at the page level.
// Cards light up individually via TiltCard's glare effect on hover.
export function AnimatedBackground() {
  return (
    <div className="bg-orbs" aria-hidden="true">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />
    </div>
  );
}
