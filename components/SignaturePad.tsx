"use client";

import { useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";

export interface SignaturePadHandle {
  toDataURL: () => string;
  isEmpty: () => boolean;
  clear: () => void;
}

const SignaturePad = forwardRef<SignaturePadHandle>((_, ref) => {
  const sigPadRef = useRef<SignatureCanvas>(null);

  useImperativeHandle(ref, () => ({
    toDataURL: () => sigPadRef.current?.toDataURL("image/png") ?? "",
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
    <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
      {/* No width/height props: the library sizes the canvas to its CSS box. */}
      <SignatureCanvas
        ref={sigPadRef}
        penColor="black"
        clearOnResize={false}
        canvasProps={{
          className: "w-full h-48 block",
          style: { touchAction: "none" },
        }}
      />
      <div className="bg-gray-50 px-3 py-1 border-t border-gray-200 flex justify-between items-center">
        <span className="text-xs text-gray-400">Sign above</span>
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
