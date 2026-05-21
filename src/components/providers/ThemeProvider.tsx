"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type DisplayMode = "LIGHT" | "DARK" | "AUTO_SYSTEM" | "AUTO_TIME";
export type ColorTheme  = "classic" | "ocean" | "forest" | "sunset" | "purple";
export type BgMode      = "theme" | "solid" | "custom";

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
  bgMode: BgMode;
  bgColor1: string;
  bgColor2: string;
  bgSolidColor: string;
  setMode: (mode: DisplayMode) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setBgMode: (mode: BgMode) => void;
  setBgColor1: (color: string) => void;
  setBgColor2: (color: string) => void;
  setBgSolidColor: (color: string) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

function getSunsetHour(): number {
  const month = new Date().getMonth();
  return Math.round(17 + (Math.sin(((month - 2) * Math.PI) / 6) + 1) * 1.5);
}

function resolveTheme(mode: DisplayMode): "light" | "dark" {
  if (mode === "LIGHT") return "light";
  if (mode === "DARK")  return "dark";
  if (mode === "AUTO_SYSTEM") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (mode === "AUTO_TIME") {
    const hour = new Date().getHours();
    return hour >= getSunsetHour() || hour < 6 ? "dark" : "light";
  }
  return "light";
}

function applyBg(bgMode: BgMode, color1: string, color2: string, solidColor: string) {
  const el = document.documentElement;
  if (bgMode === "solid") {
    el.setAttribute("data-bg-style", "solid");
    el.style.setProperty("--bg-solid-color", solidColor);
    el.style.removeProperty("--bg-orb-1-color");
    el.style.removeProperty("--bg-orb-2-color");
  } else if (bgMode === "custom") {
    el.removeAttribute("data-bg-style");
    el.style.setProperty("--bg-orb-1-color", color1);
    el.style.setProperty("--bg-orb-2-color", color2);
    el.style.removeProperty("--bg-solid-color");
  } else {
    el.removeAttribute("data-bg-style");
    el.style.removeProperty("--bg-orb-1-color");
    el.style.removeProperty("--bg-orb-2-color");
    el.style.removeProperty("--bg-solid-color");
  }
}

interface Props {
  children: React.ReactNode;
  initialMode?: DisplayMode;
}

export function ThemeProvider({ children, initialMode = "AUTO_SYSTEM" }: Props) {
  const [mode,          setModeState]      = useState<DisplayMode>(initialMode);
  const [resolvedTheme, setResolved]       = useState<"light" | "dark">("light");
  const [colorTheme,    setColorThemeState] = useState<ColorTheme>("classic");
  const [bgMode,        setBgModeState]    = useState<BgMode>("theme");
  const [bgColor1,      setBgColor1State]  = useState("#C1121F");
  const [bgColor2,      setBgColor2State]  = useState("#1D3A8A");
  const [bgSolidColor,  setBgSolidState]   = useState("#0d0f12");

  function applyDisplayTheme(m: DisplayMode) {
    const resolved = resolveTheme(m);
    setResolved(resolved);
    document.documentElement.setAttribute("data-theme", resolved === "dark" ? "dark" : "");
  }

  function setMode(m: DisplayMode) {
    setModeState(m);
    localStorage.setItem("frc-theme-mode", m);
    applyDisplayTheme(m);
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

  function setBgMode(m: BgMode) {
    setBgModeState(m);
    localStorage.setItem("frc-bg-mode", m);
    applyBg(m, bgColor1, bgColor2, bgSolidColor);
  }

  function setBgColor1(color: string) {
    setBgColor1State(color);
    localStorage.setItem("frc-bg-color1", color);
    if (bgMode === "custom") applyBg("custom", color, bgColor2, bgSolidColor);
  }

  function setBgColor2(color: string) {
    setBgColor2State(color);
    localStorage.setItem("frc-bg-color2", color);
    if (bgMode === "custom") applyBg("custom", bgColor1, color, bgSolidColor);
  }

  function setBgSolidColor(color: string) {
    setBgSolidState(color);
    localStorage.setItem("frc-bg-solid", color);
    if (bgMode === "solid") applyBg("solid", bgColor1, bgColor2, color);
  }

  function toggle() {
    const next: DisplayMode = resolvedTheme === "dark" ? "LIGHT" : "DARK";
    setMode(next);
  }

  useEffect(() => {
    // Display mode
    const storedMode = localStorage.getItem("frc-theme-mode") as DisplayMode | null;
    const effective  = storedMode ?? initialMode;
    setModeState(effective);
    applyDisplayTheme(effective);

    // Color theme
    const storedColor = localStorage.getItem("frc-color-theme") as ColorTheme | null;
    if (storedColor && storedColor !== "classic") {
      setColorThemeState(storedColor);
      document.documentElement.setAttribute("data-color-theme", storedColor);
    }

    // Background
    const storedBgMode   = (localStorage.getItem("frc-bg-mode")   as BgMode | null) ?? "theme";
    const storedBgColor1 = localStorage.getItem("frc-bg-color1") ?? "#C1121F";
    const storedBgColor2 = localStorage.getItem("frc-bg-color2") ?? "#1D3A8A";
    const storedSolid    = localStorage.getItem("frc-bg-solid")  ?? "#0d0f12";
    setBgModeState(storedBgMode);
    setBgColor1State(storedBgColor1);
    setBgColor2State(storedBgColor2);
    setBgSolidState(storedSolid);
    applyBg(storedBgMode, storedBgColor1, storedBgColor2, storedSolid);

    if (effective === "AUTO_TIME") {
      const id = setInterval(() => applyDisplayTheme("AUTO_TIME"), 60_000);
      return () => clearInterval(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{
      mode, resolvedTheme, colorTheme,
      bgMode, bgColor1, bgColor2, bgSolidColor,
      setMode, setColorTheme, toggle,
      setBgMode, setBgColor1, setBgColor2, setBgSolidColor,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
