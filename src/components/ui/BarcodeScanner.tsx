"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { acquireCamera, releaseCamera } from "@/lib/camera";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  /** Keep the camera running and report every new code (the same code again only after a pause) */
  continuous?: boolean;
  /** Label for the close button (default "Cancel") */
  closeLabel?: string;
}

/** In continuous mode, ignore the same code seen again within this long */
const REPEAT_MS = 2500;

export function BarcodeScanner({ onScan, onClose, continuous = false, closeLabel = "Cancel" }: BarcodeScannerProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const [error, setError]   = useState<string | null>(null);
  const [active, setActive] = useState(false);
  // Latest callback without restarting the camera when the parent re-renders
  const onScanRef  = useRef(onScan);
  const lastRef    = useRef<{ code: string; at: number } | null>(null);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  // Hand the camera back to the shared stream (paused, kept for the next scan — see lib/camera)
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) releaseCamera();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    function tick() {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code?.data) {
        if (!continuous) {
          stopCamera();
          onScanRef.current(code.data);
          return;
        }
        const now = Date.now();
        const last = lastRef.current;
        if (!last || last.code !== code.data || now - last.at > REPEAT_MS) {
          onScanRef.current(code.data);
          navigator.vibrate?.(60);
        }
        lastRef.current = { code: code.data, at: now };
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    async function startCamera() {
      try {
        const stream = await acquireCamera();
        if (!mounted) { releaseCamera(); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setActive(true);
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setError(
          (e as { name?: string })?.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access and try again."
            : "Camera not available on this device."
        );
      }
    }

    startCamera();
    return () => {
      mounted = false;
      stopCamera();
    };
  }, [continuous, stopCamera]);

  return (
    <div className="flex flex-col items-center gap-4">
      {error ? (
        <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger) w-full">
          {error}
        </div>
      ) : (
        <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          {/* Scan-zone overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 border-2 border-white/70 rounded-lg relative">
              {/* Corner accents */}
              {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
                <div key={i} className={`absolute w-5 h-5 border-white ${pos}
                  ${i < 2 ? "border-t-2" : "border-b-2"}
                  ${i % 2 === 0 ? "border-l-2" : "border-r-2"}`} />
              ))}
            </div>
          </div>
          {active && (
            <p className="absolute bottom-3 inset-x-0 text-center text-xs text-white/80">
              Point camera at a QR code or barcode
            </p>
          )}
        </div>
      )}

      {/* Hidden canvas used for frame processing */}
      <canvas ref={canvasRef} className="hidden" />

      <Button variant="outline" onClick={() => { stopCamera(); onClose(); }} className="w-full">
        {closeLabel}
      </Button>
    </div>
  );
}
