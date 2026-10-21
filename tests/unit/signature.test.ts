import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { encodeGrey2Png, quantizeSignature, SIGNATURE_PREFIX } from "@/lib/signature";
import { blankCanvas, decodeGreyPng, drawScribble, sampleSignature } from "../helpers/png";

// Same rule as participants_signature_check in the database.
const DB_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const DB_MAX_LENGTH = 16000;

describe("quantizeSignature", () => {
  it("returns null for an empty pad", () => {
    expect(quantizeSignature(blankCanvas(360, 192, 2), 2)).toBeNull();
  });

  it("ignores faint anti-aliasing dust", () => {
    const c = blankCanvas(100, 50);
    c.rgba[(10 * c.width + 10) * 4 + 3] = 10;
    expect(quantizeSignature(c, 1)).toBeNull();
  });

  it("trims to the ink plus a 4 px margin", () => {
    const c = blankCanvas(300, 150);
    // A filled 40 × 20 block in the middle of the pad
    for (let y = 60; y < 80; y++) for (let x = 100; x < 140; x++) c.rgba[(y * c.width + x) * 4 + 3] = 255;
    const q = quantizeSignature(c, 1)!;
    expect(q).toMatchObject({ width: 48, height: 28 });
    // Margin is white, the block is black
    expect(q.levels[0]).toBe(3);
    expect(q.levels[10 * q.width + 10]).toBe(0);
  });

  it("stores at most one pixel per CSS pixel on high-density screens", () => {
    const c = drawScribble(blankCanvas(200, 100, 3), 20, 120, 50, 15);
    const q = quantizeSignature(c, 3)!;
    // ~100 × ~35 CSS px of ink → about that many pixels, not 3× as many
    expect(q.width).toBeLessThanOrEqual(100 + 8 + 4);
    expect(q.height).toBeLessThanOrEqual(40 + 8);
  });

  it("never exceeds 240 × 80 px, whatever the pad size", () => {
    const c = drawScribble(blankCanvas(1200, 600, 2), 10, 1190, 300, 280);
    const q = quantizeSignature(c, 2)!;
    expect(q.width).toBeLessThanOrEqual(240);
    expect(q.height).toBeLessThanOrEqual(80);
  });

  it("keeps thin strokes visible when shrinking", () => {
    const c = blankCanvas(1000, 300, 1);
    // A 1 px hairline, shrunk ~4×
    for (let x = 10; x < 990; x++) c.rgba[(150 * c.width + x) * 4 + 3] = 255;
    c.rgba[(10 * c.width + 10) * 4 + 3] = 255; // stretch the box vertically
    c.rgba[(290 * c.width + 990) * 4 + 3] = 255;
    const q = quantizeSignature(c, 1)!;
    const darkest = Math.min(...q.levels);
    expect(darkest).toBeLessThan(3);
  });
});

describe("encodeGrey2Png", () => {
  it("writes a valid 2-bit greyscale PNG that decodes to the same pixels", async () => {
    const levels = Uint8Array.from({ length: 13 * 7 }, (_, i) => i % 4);
    const url = await encodeGrey2Png(13, 7, levels);
    const png = decodeGreyPng(url);
    expect(png).toMatchObject({ width: 13, height: 7, bitDepth: 2, colourType: 0 });
    expect(Array.from(png.levels)).toEqual(Array.from(levels));
  });

  it("matches the database's signature check", async () => {
    const url = await sampleSignature();
    expect(url.startsWith(SIGNATURE_PREFIX)).toBe(true);
    expect(url).toMatch(DB_PATTERN);
  });

  it("produces about a kilobyte for a typical signature", async () => {
    const url = await sampleSignature();
    expect(url.length).toBeLessThan(2500);
  });

  it("stays under the database limit even for random noise at full size", async () => {
    const levels = Uint8Array.from({ length: 240 * 80 }, () => Math.floor(Math.random() * 4));
    const url = await encodeGrey2Png(240, 80, levels);
    expect(url.length).toBeLessThan(DB_MAX_LENGTH);
  });

  it("can be embedded by pdf-lib (PDF export)", async () => {
    const url = await sampleSignature();
    const doc = await PDFDocument.create();
    const img = await doc.embedPng(Buffer.from(url.slice(SIGNATURE_PREFIX.length), "base64"));
    const png = decodeGreyPng(url);
    expect([img.width, img.height]).toEqual([png.width, png.height]);
  });
});
