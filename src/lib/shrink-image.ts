// Phone photos are big (3–8 MB). Shrink them in the browser before uploading: longest side capped,
// re-encoded as JPEG. Small files and non-images go up as they are. Client-only.

export async function shrinkImage(file: File, opts: { maxSide?: number; quality?: number; minBytes?: number } = {}): Promise<File> {
  const { maxSide = 2000, quality = 0.85, minBytes = 900 * 1024 } = opts;
  if (!file.type.startsWith("image/") || file.size < minBytes) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    // Keep the original if re-encoding didn't help
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // The server says if it can't take it
  }
}

/** A small JPEG copy of a photo for lists (longest side `side`); null if the browser can't make one */
export async function thumbnail(file: File, side = 320): Promise<File | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.75));
    return blob ? new File([blob], "thumb.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
