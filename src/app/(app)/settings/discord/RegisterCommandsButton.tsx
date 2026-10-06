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
    <>
      <Button variant="outline" size="sm" onClick={handle} isLoading={isPending}>
        Register commands
      </Button>
      {/* Full width on its own line under the buttons */}
      {result && <p className="basis-full text-small text-(--color-text-secondary) break-words">{result}</p>}
    </>
  );
}
