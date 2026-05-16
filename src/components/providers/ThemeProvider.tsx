"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type DisplayMode = "LIGHT" | "DARK" | "AUTO_SYSTEM" | "AUTO_TIME";

interface ThemeContextValue {
  mode: DisplayMode;
  resolvedTheme: "light" | "dark";
  setMode: (mode: DisplayMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

function getSunsetHour(): number {
  const month = new Date().getMonth(); // 0-11
  // rough approximation: winter ~17, summer ~20
  return Math.round(17 + (Math.sin(((month - 2) * Math.PI) / 6) + 1) * 1.5);
}

function resolveTheme(mode: DisplayMode): "light" | "dark" {
  if (mode === "LIGHT") return "light";
  if (mode === "DARK") return "dark";
  if (mode === "AUTO_SYSTEM") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (mode === "AUTO_TIME") {
    const hour = new Date().getHours();
    const sunset = getSunsetHour();
    return hour >= sunset || hour < 6 ? "dark" : "light";
  }
  return "light";
}

interface Props {
  children: React.ReactNode;
  initialMode?: DisplayMode;
}

export function ThemeProvider({ children, initialMode = "AUTO_SYSTEM" }: Props) {
  const [mode, setModeState] = useState<DisplayMode>(initialMode);
  const [resolvedTheme, setResolved] = useState<"light" | "dark">("light");

  function applyTheme(m: DisplayMode) {
    const resolved = resolveTheme(m);
    setResolved(resolved);
    document.documentElement.setAttribute("data-theme", resolved === "dark" ? "dark" : "");
  }

  function setMode(m: DisplayMode) {
    setModeState(m);
    localStorage.setItem("frc-theme-mode", m);
    applyTheme(m);
  }

  function toggle() {
    const next: DisplayMode = resolvedTheme === "dark" ? "LIGHT" : "DARK";
    setMode(next);
  }

  useEffect(() => {
    const stored = localStorage.getItem("frc-theme-mode") as DisplayMode | null;
    const effective = stored ?? initialMode;
    setModeState(effective);
    applyTheme(effective);

    // Re-evaluate for AUTO_TIME every minute
    if (effective === "AUTO_TIME") {
      const id = setInterval(() => applyTheme("AUTO_TIME"), 60_000);
      return () => clearInterval(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
