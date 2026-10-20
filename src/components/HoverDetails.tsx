"use client";

import { useState } from "react";

export interface HoverDetail {
  title: string;
  /** Color dot beside a line's value (e.g. the sub-team) */
  lines: { label: string; value: string; dot?: string }[];
  /** Longer text under a divider (e.g. the description) */
  note?: string | null;
}

/**
 * Shows a dark details card next to the mouse while it's over the children — full name
 * (even when the row cuts it off) and the details. Not shown over the row's buttons or
 * links, or over a dialog opened from the row.
 */
export function HoverDetails({ detail, children, className, style }: {
  detail: HoverDetail;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  function track(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [role=dialog]")) { setPos(null); return; }
    setPos({ x: e.clientX, y: e.clientY });
  }

  return (
    <div className={className} style={style} onMouseMove={track} onMouseLeave={() => setPos(null)} onClickCapture={() => setPos(null)}>
      {children}
      {pos && <Card detail={detail} x={pos.x} y={pos.y} />}
    </div>
  );
}

function Card({ detail, x, y }: { detail: HoverDetail; x: number; y: number }) {
  // Keep it on screen: flip left/up near the right/bottom edges
  const W = 340;
  const left = x + 16 + W > window.innerWidth ? Math.max(8, x - W - 16) : x + 16;
  const flipUp = y > window.innerHeight * 0.6;
  return (
    <div className="fixed z-50 pointer-events-none rounded-xl px-4 py-3 text-sm leading-relaxed text-white shadow-2xl border border-white/10"
      style={{ left, width: W, background: "#0f172a", ...(flipUp ? { bottom: window.innerHeight - y + 12 } : { top: y + 12 }) }}>
      <p className="text-base font-bold leading-snug mb-1.5">{detail.title}</p>
      {detail.lines.map((l) => (
        <div key={l.label} className="flex gap-2.5">
          <span className="w-24 shrink-0 text-slate-400">{l.label}</span>
          <span className="inline-flex items-start gap-1.5">
            {l.dot && <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.dot }} />}
            {l.value}
          </span>
        </div>
      ))}
      {detail.note && <p className="mt-2 pt-2 border-t border-white/15 text-slate-200 line-clamp-5 whitespace-pre-wrap">{detail.note}</p>}
    </div>
  );
}
