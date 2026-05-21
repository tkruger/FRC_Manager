"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type DisplayMode = "LIGHT" | "DARK" | "AUTO_SYSTEM" | "AUTO_TIME";
export type ColorTheme = "classic" | "ocean" | "forest" | "sunset" | "purple";

export const COLOR_THEMES: { id: ColorTheme; label: string; primary: string; secondary: string }[] = [
  { id: "classic", label: "FRC Classic", primary: "#C1121F", secondary: "#1D3A8A" },
  { id: "ocean",   label: "Ocean",       primary: "#0369A1", secondary: "#0891B2" },
  { id: "forest",  label: "Forest",      primary: "#15803D", secondary: "#D97706" },
  { id: "sunset",  label: "Sunset",      primary: "#EA580C", secondary: "#DB2777" },
  { id: "purple",  label: "Purple",      primary: "#7C3AED", secondary: "#DB2777" },
];

interface ThemeContextValue {
  mode: DisplayMode;
  resolvedTheme: "light" | "dark";
  colorTheme: ColorTheme;
  setMode: (mode: DisplayMode) => void;
  setColorTheme: (theme: ColorTheme) => void;
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
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("classic");

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

  function setColorTheme(theme: ColorTheme) {
    setColorThemeState(theme);
    localStorage.setItem("frc-color-theme", theme);
    if (theme === "classic") {
      document.documentElement.removeAttribute("data-color-theme");
    } else {
      document.documentElement.setAttribute("data-color-theme", theme);
    }
  }

  function toggle() {
    const next: DisplayMode = resolvedTheme === "dark" ? "LIGHT" : "DARK";
    setMode(next);
  }

  useEffect(() => {
    const storedMode = localStorage.getItem("frc-theme-mode") as DisplayMode | null;
    const effective = storedMode ?? initialMode;
    setModeState(effective);
    applyTheme(effective);

    const storedColor = localStorage.getItem("frc-color-theme") as ColorTheme | null;
    if (storedColor && storedColor !== "classic") {
      setColorThemeState(storedColor);
      document.documentElement.setAttribute("data-color-theme", storedColor);
    }

    if (effective === "AUTO_TIME") {
      const id = setInterval(() => applyTheme("AUTO_TIME"), 60_000);
      return () => clearInterval(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, colorTheme, setMode, setColorTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
