import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

export function formatWeight(lbs: number | null | undefined): string {
  if (lbs == null) return "—";
  return `${lbs.toFixed(1)} lbs`;
}

export function getRobotDisplayName(year: number, name: string): string {
  return `${year} ${name}`;
}

/** "15:05" → "3:05 PM" */
export function formatTime12(time24: string | null | undefined): string {
  if (!time24) return "—";
  const [h, m] = time24.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time24;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
