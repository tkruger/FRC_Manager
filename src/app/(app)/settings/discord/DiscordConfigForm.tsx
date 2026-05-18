"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDiscordConfigAction, disconnectDiscordAction } from "@/app/actions/discord-settings";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { DiscordConfig } from "@/generated/prisma";

const CHANNEL_FIELDS = [
  { name: "channelBuildAlerts", label: "Build alerts channel ID",  hint: "#build-alerts — task overdue, critical issues, weight warnings" },
  { name: "channelOrders",      label: "Orders channel ID",        hint: "#orders — purchase requests submitted, approved, received" },
  { name: "channelInventory",   label: "Inventory channel ID",     hint: "#inventory-alerts — items below threshold" },
  { name: "channelTasks",       label: "Tasks channel ID",         hint: "#build-updates — task assignments" },
  { name: "channelSafety",      label: "Safety channel ID",        hint: "#safety — incident reports" },
  { name: "channelMilestones",  label: "Milestones channel ID",    hint: "#build-updates — milestone celebrations" },
  { name: "channelGeneral",     label: "General channel ID",       hint: "#general — competition approaching announcements" },
];

export function DiscordConfigForm({ config }: { config: DiscordConfig | null }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveDiscordConfigAction, null);
  const [disconnecting, startDisconnect] = useTransition();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  function handleDisconnect() {
    if (!confirm("Disconnect Discord? This will stop all notifications and disable all commands.")) return;
    startDisconnect(async () => {
      await disconnectDiscordAction();
      router.refresh();
    });
  }

  return (
    <form action={action} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {state.error}
        </div>
      )}

      <Field
        label="Discord Guild ID"
        name="guildId"
        required
        defaultValue={config?.guildId ?? ""}
        placeholder="e.g. 1234567890123456789"
        hint="Right-click your server in Discord → Copy Server ID (Developer Mode must be on)"
      />

      <div className="border-t border-[--color-border] pt-5">
        <p className="text-h3 text-[--color-text-primary] mb-1">Channel routing</p>
        <p className="text-small text-[--color-text-secondary] mb-4">
          Enter Discord channel IDs to route notifications. Leave blank to disable that notification type.
          Right-click any channel → Copy Channel ID.
        </p>
        <div className="space-y-3">
          {CHANNEL_FIELDS.map((f) => (
            <Field
              key={f.name}
              label={f.label}
              name={f.name}
              defaultValue={(config as any)?.[f.name] ?? ""}
              placeholder="Channel ID"
              hint={f.hint}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-[--color-border] pt-5 space-y-4">
        <p className="text-h3 text-[--color-text-primary]">Daily build summary</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="dailySummaryEnabled" defaultChecked={config?.dailySummaryEnabled ?? false} className="rounded" />
          <span className="text-sm text-[--color-text-primary]">Send a daily build summary each morning</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Summary channel ID" name="dailySummaryChannel" defaultValue={config?.dailySummaryChannel ?? ""} placeholder="Channel ID" />
          <Field label="Delivery time" name="dailySummaryTime" type="time" defaultValue={config?.dailySummaryTime ?? "08:00"} />
        </div>
      </div>

      <div className="border-t border-[--color-border] pt-5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="publicReadEnabled" defaultChecked={config?.publicReadEnabled ?? false} className="rounded" />
          <div>
            <p className="text-sm font-medium text-[--color-text-primary]">Public read mode</p>
            <p className="text-small text-[--color-text-secondary]">Allow unlinked Discord members to use read-only commands</p>
          </div>
        </label>
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        <Button type="submit" isLoading={pending}>Save configuration</Button>
        {config?.active && (
          <Button type="button" variant="danger" onClick={handleDisconnect} isLoading={disconnecting}>
            Disconnect Discord
          </Button>
        )}
      </div>
    </form>
  );
}
