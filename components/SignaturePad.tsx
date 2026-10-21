"use client";

import { useRef, useImperativeHandle, forwardRef, useEffect, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { signatureToPng } from "@/lib/signature";

export interface SignaturePadHandle {
  /** Compact PNG data URL (a few KB), "" when nothing was drawn */
  toPng: () => Promise<string>;
  isEmpty: () => boolean;
  clear: () => void;
}

const SignaturePad = forwardRef<SignaturePadHandle>((_, ref) => {
  const sigPadRef = useRef<SignatureCanvas>(null);
  // The pad only takes strokes after a deliberate tap, so scrolling or
  // brushing against it does not leave marks.
  const [armed, setArmed] = useState(false);
  // Where the press on the lock started: a drag across it is not a tap.
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    toPng: async () => {
      const pad = sigPadRef.current;
      if (!pad || pad.isEmpty()) return "";
      const canvas = pad.getCanvas();
      // The library scales the canvas by the device pixel ratio.
      return signatureToPng(canvas, canvas.width / Math.max(canvas.offsetWidth, 1));
    },
    isEmpty: () => sigPadRef.current?.isEmpty() ?? true,
    clear: () => sigPadRef.current?.clear(),
  }));

  // The canvas' pixel size must match its on-screen size, otherwise strokes
  // drift away from the finger. Re-fit when the width really changes (e.g.
  // rotating the phone) and redraw the strokes instead of wiping them – mobile
  // browsers fire "resize" whenever the address bar shows or hides.
  useEffect(() => {
    const pad = sigPadRef.current;
    if (!pad) return;
    let lastWidth = pad.getCanvas().offsetWidth;

    function onResize() {
      const canvas = pad!.getCanvas();
      if (canvas.offsetWidth === lastWidth) return;
      lastWidth = canvas.offsetWidth;
      const data = pad!.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")!.scale(ratio, ratio);
      pad!.clear();
      pad!.fromData(data);
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      className={`border rounded-md overflow-hidden bg-white ${
        armed ? "border-esn ring-2 ring-esn-accent/40" : "border-gray-300"
      }`}
    >
      <div className="relative">
        {/* No width/height props: the library sizes the canvas to its CSS box. */}
        <SignatureCanvas
          ref={sigPadRef}
          penColor="black"
          clearOnResize={false}
          canvasProps={{
            className: "w-full h-48 block",
            // While locked, touches scroll the page instead of drawing.
            style: { touchAction: armed ? "none" : "auto", pointerEvents: armed ? "auto" : "none" },
          }}
        />
        {!armed && (
          <button
            type="button"
            onPointerDown={(e) => {
              pressStart.current = { x: e.clientX, y: e.clientY };
            }}
            onClick={(e) => {
              const start = pressStart.current;
              pressStart.current = null;
              // Keyboard "clicks" have no pointer press and always count.
              if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
              setArmed(true);
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50/90 text-esn hover:bg-gray-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-esn-accent"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-7 w-7">
              <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
            </svg>
            <span className="text-sm font-medium">Tap here to sign</span>
          </button>
        )}
      </div>
      <div className="bg-gray-50 px-3 py-1 border-t border-gray-200 flex justify-between items-center">
        <span className="text-xs text-gray-400">{armed ? "Sign above with your finger" : "Locked until you tap"}</span>
        <button
          type="button"
          onClick={() => sigPadRef.current?.clear()}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Clear
        </button>
      </div>
    </div>
  );
});

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
