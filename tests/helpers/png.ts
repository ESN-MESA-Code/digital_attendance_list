// Synthetic signatures and a small PNG reader for checking what the
// signature encoder produces.
import { inflateSync, crc32 } from "node:zlib";
import { quantizeSignature, encodeGrey2Png, SIGNATURE_PREFIX } from "@/lib/signature";

/** An RGBA canvas like the signature pad's: transparent, ink in the alpha channel. */
export function blankCanvas(cssWidth: number, cssHeight: number, pixelRatio = 1) {
  const width = Math.round(cssWidth * pixelRatio);
  const height = Math.round(cssHeight * pixelRatio);
  return { width, height, pixelRatio, rgba: new Uint8ClampedArray(width * height * 4) };
}

type Canvas = ReturnType<typeof blankCanvas>;

/** Anti-aliased round dot at CSS coordinates. */
function dot(c: Canvas, cssX: number, cssY: number, cssRadius: number) {
  const cx = cssX * c.pixelRatio, cy = cssY * c.pixelRatio, r = cssRadius * c.pixelRatio;
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue;
      const a = Math.max(0, Math.min(1, r + 0.5 - Math.hypot(x - cx, y - cy)));
      const i = (y * c.width + x) * 4 + 3;
      c.rgba[i] = Math.max(c.rgba[i], a * 255);
    }
  }
}

/** Draws a wavy, signature-like stroke from x0 to x1 (CSS px) around y. */
export function drawScribble(c: Canvas, x0: number, x1: number, y: number, amplitude: number) {
  for (let t = 0; t <= 1; t += 0.0005) {
    const x = x0 + t * (x1 - x0);
    const yy = y + amplitude * Math.sin(t * 25) * Math.cos(t * 7);
    dot(c, x, yy, 1 + 1.2 * Math.abs(Math.sin(t * 13)));
  }
  return c;
}

/** A realistic signature as stored by the form (phone-sized pad at 3×). */
export async function sampleSignature() {
  const c = drawScribble(blankCanvas(360, 192, 3), 40, 320, 96, 40);
  const q = quantizeSignature(c, c.pixelRatio)!;
  return encodeGrey2Png(q.width, q.height, q.levels);
}

export interface DecodedPng {
  width: number;
  height: number;
  bitDepth: number;
  colourType: number;
  /** One grey level per pixel (0 … 2^bitDepth − 1) */
  levels: Uint8Array;
}

/** Parses a greyscale PNG data URL, checking signature and CRCs. */
export function decodeGreyPng(dataUrl: string): DecodedPng {
  if (!dataUrl.startsWith(SIGNATURE_PREFIX)) throw new Error("not a PNG data URL");
  const png = Buffer.from(dataUrl.slice(SIGNATURE_PREFIX.length), "base64");
  if (!png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("bad PNG signature");
  }
  let offset = 8;
  let ihdr: Buffer | null = null;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("latin1", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    const crc = png.readUInt32BE(offset + 8 + length);
    if (crc32(png.subarray(offset + 4, offset + 8 + length)) !== crc) throw new Error(`bad CRC in ${type}`);
    if (type === "IHDR") ihdr = data;
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
    if (type === "IEND") break;
  }
  if (!ihdr) throw new Error("no IHDR");
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colourType = ihdr[9];
  if (colourType !== 0 || ihdr[12] !== 0) throw new Error("only non-interlaced greyscale supported");

  const raw = inflateSync(Buffer.concat(idat));
  const rowBytes = Math.ceil((width * bitDepth) / 8);
  if (raw.length !== (rowBytes + 1) * height) throw new Error("bad image data length");
  const levels = new Uint8Array(width * height);
  const perByte = 8 / bitDepth;
  const mask = (1 << bitDepth) - 1;
  for (let y = 0; y < height; y++) {
    const row = y * (rowBytes + 1);
    if (raw[row] !== 0) throw new Error("only filter type 0 supported");
    for (let x = 0; x < width; x++) {
      const byte = raw[row + 1 + Math.floor(x / perByte)];
      levels[y * width + x] = (byte >> (8 - bitDepth * ((x % perByte) + 1))) & mask;
    }
  }
  return { width, height, bitDepth, colourType, levels };
}
