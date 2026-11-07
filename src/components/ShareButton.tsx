"use client";

import { useSyncExternalStore } from "react";
import { Share, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Share a link to something in the app — an order, a task, a meeting, a claim. On phones it opens the
// phone's own share sheet (Messages, WhatsApp, Mail, …); on a computer it copies the link. Whoever opens
// it signs in if they need to and lands right on it.

const isApple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
const touch = () => window.matchMedia("(pointer: coarse)").matches;
const noop = () => () => {};

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Open the share sheet (phones) or copy the link (computers) — the button, and the header menu */
export async function shareLink(path: string, title: string, text?: string) {
  const url = new URL(path, window.location.origin).toString();
  if (navigator.share && touch()) {
    try {
      await navigator.share({ title, text: text ?? title, url });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // closed the share sheet
    }
  }
  if (await copy(url)) toast.success("Link copied — paste it anywhere");
  else window.prompt("Copy this link:", url);
}

export function ShareButton({ path, title, text, label = false, className }: {
  /** The page to share, e.g. /procurement/requests/abc */
  path: string;
  /** What it is — the share sheet's title, and the start of the message */
  title: string;
  /** A line to send with the link (default: the title) */
  text?: string;
  /** Show "Share" next to the icon (default: just the icon) */
  label?: boolean;
  className?: string;
}) {
  // The iPhone-style icon on Apple devices, the three dots elsewhere (worked out after loading)
  const apple = useSyncExternalStore(noop, isApple, () => false);
  const Icon = apple ? Share : Share2;

  const share = () => shareLink(path, title, text);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={share}
      aria-label={label ? undefined : `Share ${title}`}
      title="Share a link"
      className={cn(!label && "px-2", className)}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label && "Share"}
    </Button>
  );
}
