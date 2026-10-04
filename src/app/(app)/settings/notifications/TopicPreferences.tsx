"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setTopicPreferenceAction } from "@/app/actions/notification-settings";

interface Topic {
  id:          string;
  group:       string;
  label:       string;
  description: string;
  audience:    string;
  required:    boolean;
  inApp:       boolean;
  push:        boolean;
}

export function TopicPreferences({ topics: initial }: { topics: Topic[] }) {
  const [topics, setTopics] = useState(initial);
  const [error, setError]   = useState<string | null>(null);
  const [, start]           = useTransition();
  const groups = [...new Set(topics.map((t) => t.group))];

  function toggle(id: string, field: "inApp" | "push") {
    const t = topics.find((x) => x.id === id)!;
    const next = { ...t, [field]: !t[field] };
    setTopics((all) => all.map((x) => (x.id === id ? next : x))); // optimistic
    setError(null);
    start(async () => {
      const res = await setTopicPreferenceAction(id, next.inApp, next.push);
      if (!res.success) {
        setTopics((all) => all.map((x) => (x.id === id ? t : x)));
        setError(res.error);
      }
    });
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-h3 text-(--color-text-primary)">What to notify me about</h2>
        <div className="hidden sm:flex gap-6 pr-1 text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
          <span className="w-12 text-center">In app</span>
          <span className="w-12 text-center">Push</span>
        </div>
      </div>
      {error && <p className="text-sm text-(--color-danger)">{error}</p>}

      {groups.map((group) => (
        <div key={group} className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary) pt-2">{group}</h3>
          <ul className="divide-y divide-(--color-border)">
            {topics.filter((t) => t.group === group).map((t) => (
              <li key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--color-text-primary)">{t.label}</p>
                  <p className="text-small text-(--color-text-secondary)">{t.description}</p>
                  <p className="text-xs text-(--color-text-disabled) mt-0.5">Sent to: {t.audience}</p>
                </div>
                <div className="flex gap-6 shrink-0">
                  <Toggle label="In app" checked={t.inApp} disabled={t.required} onChange={() => toggle(t.id, "inApp")} />
                  <Toggle label="Push"   checked={t.push}  onChange={() => toggle(t.id, "push")} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <label className={cn("flex sm:w-12 sm:justify-center items-center gap-2", disabled ? "opacity-50" : "cursor-pointer")}>
      <span className="sm:sr-only text-small text-(--color-text-secondary)">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "relative h-6 w-10 rounded-full transition-colors",
          checked ? "bg-(--color-primary)" : "bg-(--color-border-strong)"
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        )} />
      </button>
    </label>
  );
}
