"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { APP_ICONS, APP_ICON_COOKIE, appIconPath, type AppIconId } from "@/lib/app-icons";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Choose the home-screen icon for this device. Applies the next time the app is added. */
export function AppIconPicker({ current }: { current: AppIconId }) {
  const router = useRouter();
  const [selected, setSelected] = useState<AppIconId>(current);

  function choose(id: AppIconId) {
    setSelected(id);
    document.cookie = `${APP_ICON_COOKIE}=${id}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    toast.success("App icon saved — re-add FRC Manager to your home screen to see it");
    router.refresh(); // re-render the page head with the new icon links
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-h3 text-(--color-text-primary)">App icon</h2>
        <p className="text-small text-(--color-text-secondary) mt-1">
          The icon used when you add FRC Manager to your home screen on this device. Phones only read it when the app
          is added, so after choosing, remove FRC Manager from your home screen and add it again.
        </p>
      </div>

      <div role="radiogroup" aria-label="App icon" className="grid grid-cols-4 gap-3">
        {APP_ICONS.map((icon) => {
          const on = icon.id === selected;
          return (
            <button
              key={icon.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={icon.label}
              title={icon.label}
              onClick={() => choose(icon.id)}
              className="group flex flex-col items-center gap-1.5 rounded-xl p-1 text-center"
            >
              <span className={cn(
                "relative block w-full overflow-hidden rounded-[22%] ring-2 transition-all",
                on ? "ring-(--color-primary) scale-105 shadow-lg" : "ring-transparent group-hover:ring-(--color-border-strong)"
              )}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={appIconPath(icon.id, "icon-192.png")} alt="" className="block aspect-square w-full" loading="lazy" />
                {on && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-(--color-primary) text-[11px] font-bold text-white">✓</span>
                )}
              </span>
              <span className={cn("hidden sm:block text-xs leading-tight", on ? "font-semibold text-(--color-text-primary)" : "text-(--color-text-secondary)")}>
                {icon.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-small text-(--color-text-secondary) sm:hidden">
        Selected: <span className="font-medium text-(--color-text-primary)">{APP_ICONS.find((i) => i.id === selected)?.label}</span>
      </p>
    </section>
  );
}
