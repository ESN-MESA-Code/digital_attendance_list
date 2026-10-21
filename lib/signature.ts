// Turns a drawn signature into the smallest PNG that still looks right.
//
// The pad draws black ink on a transparent canvas at device resolution
// (often 3× on phones), and the browser's own PNG is 32-bit RGBA – easily
// 30–100 KB. A signature only needs a few shades of grey, so we:
//   1. trim to the ink plus a small margin,
//   2. shrink to at most 1 CSS pixel per pixel and MAX_W × MAX_H,
//      averaging every source pixel that falls into a target pixel,
//   3. store 2 bits per pixel (black, two greys for smooth edges, white),
// which, deflated, is about 1 KB (~1.5 KB as base64).

/** Largest stored size: ~320 dpi in the 18 pt PDF row, 2× on the 80 × 40 px dashboard. */
const MAX_W = 240;
const MAX_H = 80;
/** Margin around the ink, in output pixels. */
const MARGIN = 4;
/** Alpha below this counts as empty when trimming (anti-aliasing dust). */
const INK_THRESHOLD = 16;
/** Thin strokes average out to light grey when shrunk; darken them again. */
const INK_BOOST = 1.8;

export const SIGNATURE_PREFIX = "data:image/png;base64,";

/** Canvas pixels: black ink on transparent, so the alpha channel is the ink. */
interface Ink {
  width: number;
  height: number;
  /** RGBA bytes, ink = alpha */
  rgba: Uint8ClampedArray;
}

/**
 * Shrinks the ink to 2-bit grey levels (0 = black … 3 = white).
 * `pixelRatio` is the canvas' device pixel ratio. Returns null for an empty pad.
 */
export function quantizeSignature({ width, height, rgba }: Ink, pixelRatio: number) {
  // 1. Bounding box of the ink.
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > INK_THRESHOLD) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const srcW = x1 - x0 + 1;
  const srcH = y1 - y0 + 1;

  // 2. Scale: never above 1 CSS pixel per pixel, never above MAX_W × MAX_H.
  const scale = Math.min(
    1 / Math.max(pixelRatio, 1),
    (MAX_W - 2 * MARGIN) / srcW,
    (MAX_H - 2 * MARGIN) / srcH
  );
  const inkW = Math.max(1, Math.round(srcW * scale));
  const inkH = Math.max(1, Math.round(srcH * scale));
  const outW = inkW + 2 * MARGIN;
  const outH = inkH + 2 * MARGIN;

  // Every output pixel averages the source pixels it covers (box filter), so
  // strokes thinner than a pixel turn grey instead of disappearing.
  const levels = new Uint8Array(outW * outH).fill(3);
  const sx = srcW / inkW;
  const sy = srcH / inkH;
  for (let oy = 0; oy < inkH; oy++) {
    const ya = y0 + Math.floor(oy * sy);
    const yb = Math.max(ya + 1, y0 + Math.floor((oy + 1) * sy));
    for (let ox = 0; ox < inkW; ox++) {
      const xa = x0 + Math.floor(ox * sx);
      const xb = Math.max(xa + 1, x0 + Math.floor((ox + 1) * sx));
      let sum = 0;
      for (let y = ya; y < yb; y++) {
        for (let x = xa; x < xb; x++) sum += rgba[(y * width + x) * 4 + 3];
      }
      const ink = Math.min(1, (sum / ((yb - ya) * (xb - xa) * 255)) * INK_BOOST);
      levels[(oy + MARGIN) * outW + ox + MARGIN] = 3 - Math.round(ink * 3);
    }
  }
  return { width: outW, height: outH, levels };
}

// ── Minimal PNG writer: greyscale, 2 bits per pixel ─────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** zlib-deflate with the browser's (or Node's) built-in CompressionStream. */
async function deflate(bytes: Uint8Array) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** PNG data URL of 2-bit grey levels (0 = black … 3 = white). */
export async function encodeGrey2Png(width: number, height: number, levels: Uint8Array) {
  // Each row: filter byte 0 (none), then 4 pixels per byte, leftmost in the high bits.
  const rowBytes = Math.ceil(width / 4);
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (rowBytes + 1) + 1;
    for (let x = 0; x < width; x++) {
      raw[row + (x >> 2)] |= levels[y * width + x] << (6 - 2 * (x & 3));
    }
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 2; // bit depth
  ihdr[9] = 0; // colour type: greyscale
  // compression, filter and interlace methods: 0

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", await deflate(raw)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    png.set(p, offset);
    offset += p.length;
  }
  return SIGNATURE_PREFIX + toBase64(png);
}

/** Compact PNG data URL of the signature drawn on `canvas`, or "" if it is empty. */
export async function signatureToPng(canvas: HTMLCanvasElement, pixelRatio: number) {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const q = quantizeSignature(
    { width, height, rgba: ctx.getImageData(0, 0, width, height).data },
    pixelRatio
  );
  if (!q) return "";
  return encodeGrey2Png(q.width, q.height, q.levels);
}
