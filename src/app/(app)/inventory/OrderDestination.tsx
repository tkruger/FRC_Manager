"use client";

import { Select } from "@/components/ui/select";

/** One of your saved order drafts (shown in the inventory "Order" dialogs) */
export interface DraftOption { id: string; name: string; items: number }

/**
 * Where an inventory "Order" dialog puts its item: one of your open drafts, a new draft, or an order
 * of its own sent now. Sends `destination`; `onChange` lets the dialog name its button to match.
 */
export function OrderDestination({ drafts, value, onChange }: {
  drafts: DraftOption[]; value: string; onChange: (value: string) => void;
}) {
  const options = [
    ...drafts.map((d) => ({ value: `draft:${d.id}`, label: `Draft: ${d.name} (${d.items} ${d.items === 1 ? "item" : "items"})` })),
    { value: "new-draft", label: "A new draft" },
    { value: "submit", label: "Its own order, submitted now" },
  ];
  return (
    <Select label="Add it to" name="destination" options={options} value={value} onChange={(e) => onChange(e.target.value)}
      hint={value === "submit" ? "Sent for approval straight away." : "Finish and submit the draft from Orders — add more items to it first if you like."} />
  );
}

/** What the dialog starts with: your most recent draft, or a new one */
export const firstDestination = (drafts: DraftOption[]) => (drafts[0] ? `draft:${drafts[0].id}` : "new-draft");

/** The submit button's words for a destination */
export const destinationButton = (value: string) => (value === "submit" ? "Submit order" : value === "new-draft" ? "Start the draft" : "Add to draft");
