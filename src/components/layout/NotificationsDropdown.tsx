"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

const TYPE_ICONS: Record<string, string> = {
  REORDER_TRIGGERED:       "📦",
  PURCHASE_SUBMITTED:      "🛒",
  PURCHASE_APPROVED:       "✅",
  PURCHASE_DENIED:         "❌",
  ORDER_RECEIVED:          "📬",
  TASK_DUE_SOON:           "📅",
  TASK_OVERDUE:            "⚠️",
  TASK_BLOCKED:            "🚧",
  CRITICAL_ISSUE:          "🔴",
  WEIGHT_WARNING:          "⚖️",
  BOM_CAP_WARNING:         "📋",
  TOOL_OVERDUE:            "🔧",
  CERT_EXPIRING:           "🎓",
  SAFETY_INCIDENT:         "🚨",
  COMPETITION_APPROACHING: "🏆",
  MEMBER_APPROVAL_NEEDED:  "👤",
  ACCOUNT_APPROVED:        "✅",
  ACCOUNT_DENIED:          "❌",
};

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationsDropdown({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const [open, setOpen]           = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]     = useState(false);
  const [localUnread, setLocalUnread] = useState(unreadCount);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => { setNotifications(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open]);

  // Mark all read when dropdown opens
  useEffect(() => {
    if (!open || localUnread === 0) return;
    fetch("/api/notifications", { method: "POST", body: JSON.stringify({ ids: [] }) })
      .then(() => { setLocalUnread(0); router.refresh(); })
      .catch(() => {});
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-md flex items-center justify-center text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors"
        aria-label={`Notifications${localUnread > 0 ? ` (${localUnread} unread)` : ""}`}
        aria-expanded={open}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {localUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
            style={{ backgroundColor: "var(--color-primary)" }} aria-hidden>
            {localUnread > 9 ? "9+" : localUnread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[--color-border] shadow-xl z-50 overflow-hidden"
          style={{ backgroundColor: "var(--color-surface)" }}
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-border]">
            <p className="text-sm font-semibold text-[--color-text-primary]">Notifications</p>
            {notifications.length > 0 && (
              <Link href="/notifications" onClick={() => setOpen(false)}
                className="text-xs text-[--color-secondary] hover:underline">
                View all
              </Link>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-[--color-border]/50">
            {loading && (
              <div className="px-4 py-6 text-center text-small text-[--color-text-secondary]">
                Loading…
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-small text-[--color-text-secondary]">No notifications yet</p>
              </div>
            )}
            {!loading && notifications.map((n) => (
              <div
                key={n.id}
                className={`flex gap-3 px-4 py-3 transition-colors hover:bg-[--color-surface-overlay] ${!n.read ? "bg-[--color-primary]/4" : ""}`}
              >
                <span className="text-base shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--color-text-primary] leading-snug">{n.title}</p>
                  {n.body && <p className="text-small text-[--color-text-secondary] mt-0.5 truncate">{n.body}</p>}
                  <p className="text-[10px] text-[--color-text-disabled] mt-1">{formatDate(n.createdAt)}</p>
                </div>
                {n.linkUrl && (
                  <Link href={n.linkUrl} onClick={() => setOpen(false)}
                    className="shrink-0 text-[--color-secondary] hover:text-[--color-primary] mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
