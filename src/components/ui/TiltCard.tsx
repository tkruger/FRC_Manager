"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: number;
  glare?: boolean;
}

export function TiltCard({ children, className, intensity = 6, glare = true, style, ...props }: TiltCardProps) {
  const ref      = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x  = e.clientX - rect.left;
    const y  = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rx = ((y - cy) / cy) * -intensity;
    const ry = ((x - cx) / cx) * intensity;

    ref.current.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(10px)`;

    // Directional shadow + glow — via boxShadow only, never touch borderColor
    // so the inline borderLeftColor set by the parent is always preserved.
    ref.current.style.boxShadow = [
      `${ry * -2}px ${rx * 2}px 40px -8px rgba(0,0,0,0.40)`,
      `0 0 0 1px rgba(255,255,255,0.08)`,
      `0 0 28px -4px color-mix(in srgb, var(--color-primary) 35%, transparent)`,
    ].join(", ");

    if (glare && glareRef.current) {
      const gx = (x / rect.width) * 100;
      const gy = (y / rect.height) * 100;
      glareRef.current.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.13) 0%, transparent 60%)`;
      glareRef.current.style.opacity = "1";
    }
  }

  function handleMouseLeave() {
    if (!ref.current) return;
    ref.current.style.transform = "";
    ref.current.style.boxShadow = "";
    // Do NOT clear borderColor — parent's inline borderLeftColor must persist
    if (glareRef.current) glareRef.current.style.opacity = "0";
  }

  return (
    <div
      ref={ref}
      className={cn("card", className)}
      style={{ transformStyle: "preserve-3d", transition: "transform 0.15s ease, box-shadow 0.15s ease", ...style }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {glare && (
        <div ref={glareRef}
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200"
          style={{ zIndex: 1 }} />
      )}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}
