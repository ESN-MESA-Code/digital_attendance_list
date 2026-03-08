"use client";

import { useRef, useImperativeHandle, forwardRef } from "react";
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

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
      <SignatureCanvas
        ref={sigPadRef}
        penColor="black"
        canvasProps={{
          width: 500,
          height: 150,
          className: "w-full",
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
