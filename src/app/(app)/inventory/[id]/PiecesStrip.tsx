"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { Camera, MapPin, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { updateItemImageAction, updatePieceAction, markPieceUsedUpAction } from "@/app/actions/inventory";
import { uploadPhoto } from "@/lib/upload-photo";
import { AcquireButton } from "../AcquireButton";
import { printStockLabel } from "./StockPanels";

export interface Piece {
  id: string;
  code: string;
  amountLeft: string | null;
  storageLocation: string | null;
  image: string | null;
  /** Usually 1 — older entries may hold more than one piece */
  count: number;
}

/**
 * The partial pieces of an item, one card each — scroll through them and manage each on the spot: its
 * photo, its own label code, how much is left and where it is; use it on a robot or mark it used up.
 */
export function PiecesStrip({ name, pieces, canEdit, robots }: {
  name: string; pieces: Piece[]; canEdit: boolean; robots: { id: string; displayName: string }[];
}) {
  // A link to one piece (#piece-…, from the inventory list or a label) scrolls to it and marks it
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    const id = window.location.hash.replace(/^#piece-/, "");
    if (!id || !pieces.some((p) => p.id === id)) return;
    const el = document.getElementById(`piece-${id}`);
    el?.scrollIntoView({ block: "nearest", inline: "center" });
    el?.closest("section")?.scrollIntoView({ block: "start" });
    const t = setTimeout(() => setFocus(id), 0);
    return () => clearTimeout(t);
  }, [pieces]);

  if (pieces.length === 0) {
    return <p className="text-small text-(--color-text-secondary)">No partial pieces. When a piece is cut off or part of a spool is left, <b>Add a partial piece</b>.</p>;
  }
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
      {pieces.map((p) => <PieceCard key={p.id} piece={p} name={name} canEdit={canEdit} robots={robots} focused={focus === p.id} />)}
    </div>
  );
}

function PieceCard({ piece, name, canEdit, robots, focused }: {
  piece: Piece; name: string; canEdit: boolean; robots: { id: string; displayName: string }[]; focused: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(piece.amountLeft ?? "");
  const [where, setWhere] = useState(piece.storageLocation ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const svgId = `piece-qr-${piece.id}`;
  const detail = piece.amountLeft ? `Partial — ${piece.amountLeft} left` : "Partial piece";

  const save = (field: "amountLeft" | "storageLocation", value: string, was: string | null) => {
    if (value.trim() === (was ?? "")) return;
    start(async () => {
      const res = await updatePieceAction(piece.id, { [field]: value });
      if (!res.success) { toast.error(res.error ?? "Couldn't save."); return; }
      toast.success("Saved");
      router.refresh();
    });
  };

  async function photo(file: File) {
    setUploading(true);
    try {
      const url = await uploadPhoto(file);
      const res = await updateItemImageAction(piece.id, url);
      if (!res.success) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't upload the photo.");
    } finally {
      setUploading(false);
    }
  }

  const inputCls = "w-full rounded-md border border-(--color-border) bg-(--color-surface) px-2.5 py-1.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-disabled) focus:border-(--color-primary) focus:outline-none";

  return (
    <article id={`piece-${piece.id}`}
      className={cn("w-64 shrink-0 snap-start rounded-xl border bg-(--color-surface) p-3 space-y-3 scroll-mt-24",
        focused ? "border-(--color-primary) ring-2 ring-(--color-primary)/40" : "border-(--color-border)")}>
      {/* Photo — tap to add or change */}
      <button type="button" disabled={!canEdit || uploading} onClick={() => fileRef.current?.click()}
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-(--color-border) bg-(--color-surface-overlay) text-(--color-text-secondary)">
        {piece.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={piece.image} alt={`${name} — ${detail}`} className="h-full w-full object-cover" />
          : <span className="flex flex-col items-center gap-1 text-small"><Camera className="h-6 w-6" aria-hidden />{canEdit ? "Add a photo" : "No photo"}</span>}
        {canEdit && piece.image && <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">Change</span>}
        {uploading && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">Uploading…</span>}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void photo(f); }} />

      {/* Its own code */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-(--color-text-primary)">{piece.code}</p>
          {piece.count > 1 && <p className="text-xs text-(--color-text-secondary)">{piece.count} pieces share this code</p>}
        </div>
        <span className="rounded bg-white p-1"><QRCode id={svgId} value={piece.code} size={44} level="M" /></span>
      </div>

      {canEdit ? (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-(--color-text-secondary)">Amount left</span>
            <input className={inputCls} value={amount} maxLength={120} placeholder="e.g. about 18 in"
              onChange={(e) => setAmount(e.target.value)} onBlur={() => save("amountLeft", amount, piece.amountLeft)} />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-(--color-text-secondary)">Where it is</span>
            <input className={inputCls} value={where} maxLength={300} placeholder="e.g. Offcut rack"
              onChange={(e) => setWhere(e.target.value)} onBlur={() => save("storageLocation", where, piece.storageLocation)} />
          </label>
        </div>
      ) : (
        <div className="space-y-1 text-sm text-(--color-text-primary)">
          <p>{piece.amountLeft ? `${piece.amountLeft} left` : "Partial piece"}</p>
          {piece.storageLocation && <p className="flex items-center gap-1 text-small text-(--color-text-secondary)"><MapPin className="h-3.5 w-3.5" aria-hidden />{piece.storageLocation}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => printStockLabel({ name, code: piece.code, detail, svgId })}>
          <Printer className="h-4 w-4" aria-hidden /> Label
        </Button>
        <AcquireButton itemId={piece.id} itemName={`${name} (${piece.code})`} robots={robots} maxQty={piece.count} />
        {canEdit && (
          <Button type="button" size="sm" variant="danger" disabled={pending}
            onClick={() => {
              if (!confirm(`Mark ${piece.code} used up? It's taken out of the inventory.`)) return;
              start(async () => {
                const res = await markPieceUsedUpAction(piece.id);
                if (!res.success) { toast.error(res.error ?? "Couldn't change it."); return; }
                toast.success(`${piece.code} used up`);
                router.refresh();
              });
            }}>
            Used up
          </Button>
        )}
      </div>
      <Link href={`/inventory/${piece.id}`} className="block text-small text-(--color-secondary) hover:underline">History &amp; details →</Link>
    </article>
  );
}
