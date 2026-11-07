// Upload a photo (tools, inventory) from the browser: shrunk first, then stored; returns its address.
// Client-only.

import { shrinkImage } from "@/lib/shrink-image";

export async function uploadPhoto(original: File): Promise<string> {
  // A photo of a part doesn't need to be bigger than this (a phone photo is 3–8 MB; this is ~200–400 KB)
  const file = await shrinkImage(original, { maxSide: 1600, quality: 0.82, minBytes: 300 * 1024 });
  const fd = new FormData();
  fd.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/tools/upload", { method: "POST", body: fd });
  } catch {
    throw new Error("Upload failed — check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed.");
  return data.url as string;
}
