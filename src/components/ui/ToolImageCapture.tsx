"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./button";

interface Props {
  /** Hidden input name — value will be the uploaded blob URL */
  name?: string;
  defaultUrl?: string | null;
  /** Called after a successful upload with the resulting URL */
  onUrl?: (url: string | null) => void;
}

export function ToolImageCapture({ name = "imageUrl", defaultUrl, onUrl }: Props) {
  const [imageUrl,    setImageUrl]    = useState<string | null>(defaultUrl ?? null);
  const [preview,     setPreview]     = useState<string | null>(defaultUrl ?? null);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showWebcam,  setShowWebcam]  = useState(false);
  const [hasCamera,   setHasCamera]   = useState(false);

  const fileRef  = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Detect getUserMedia support after mount
  useEffect(() => {
    setHasCamera(!!navigator.mediaDevices?.getUserMedia);
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res  = await fetch("/api/tools/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload failed."); setUploading(false); return; }
      setImageUrl(data.url);
      onUrl?.(data.url);
    } catch {
      setError("Upload failed — check your connection.");
    }
    setUploading(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local preview immediately
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    upload(file);
  }

  async function startWebcam() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setShowWebcam(true);
      // Attach stream after state update lets video element mount
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      setError("Could not access camera. Check browser permissions.");
    }
  }

  function stopWebcam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowWebcam(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPreview(dataUrl);
    stopWebcam();
    canvas.toBlob((blob) => {
      if (blob) upload(new File([blob], "webcam.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  function clear() {
    setImageUrl(null);
    setPreview(null);
    onUrl?.(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {/* Hidden value for server action */}
      <input type="hidden" name={name} value={imageUrl ?? ""} />

      {/* Webcam modal */}
      {showWebcam && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg bg-black aspect-video object-cover"
          />
          <div className="flex gap-2">
            <Button type="button" onClick={capture} size="sm">
              Capture photo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={stopWebcam}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && !showWebcam && (
        <div className="relative w-full aspect-video max-h-56 rounded-lg overflow-hidden bg-[--color-surface-overlay]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Tool photo" className="w-full h-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="text-white text-sm font-medium">Uploading…</span>
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={clear}
              title="Remove photo"
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-base leading-none"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      {!showWebcam && (
        <div className="flex flex-wrap gap-2">
          {/* File / camera input */}
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[--color-border] text-sm font-medium text-[--color-text-secondary] hover:border-[--color-border-strong] hover:text-[--color-text-primary] cursor-pointer transition-colors bg-[--color-surface]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            {preview ? "Replace photo" : "Upload / take photo"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="sr-only"
            />
          </label>

          {/* Webcam button — only when getUserMedia available */}
          {hasCamera && !preview && (
            <button
              type="button"
              onClick={startWebcam}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[--color-border] text-sm font-medium text-[--color-text-secondary] hover:border-[--color-border-strong] hover:text-[--color-text-primary] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Use webcam
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-[--color-danger]">{error}</p>
      )}
    </div>
  );
}
