"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RegisterCommandsButton() {
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/discord/register", { method: "POST" });
        const data = await res.json();
        if (res.ok) {
          setResult(`✅ Registered ${data.registered} commands: ${data.commands.join(", ")}`);
        } else {
          setResult(`❌ ${data.error}`);
        }
      } catch (e: any) {
        setResult(`❌ ${e.message}`);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="outline" size="sm" onClick={handle} isLoading={isPending}>
        Register commands
      </Button>
      {result && <p className="text-small text-[--color-text-secondary] max-w-xs text-right">{result}</p>}
    </div>
  );
}
