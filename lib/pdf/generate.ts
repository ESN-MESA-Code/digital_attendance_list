import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, PDFPage, PDFFont, PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ESN_LOGO_PNG_BASE64 } from "./esn-logo";
import { countryName, DEFAULT_EXPORT_LANG, type Lang } from "@/lib/countries";
import type { Event, Participant } from "@/types";

/* ────────────────────────────────────────────────────────────────────────────
   Layout of the official MESA e.V. "Teilnehmendenliste" (vertical / A4 portrait).
   Every coordinate below was measured off the Word/PDF template, so the export
   lines up with the printed form sheet. PDF user space: origin bottom-left, pt.
──────────────────────────────────────────────────────────────────────────── */

const PAGE_W = 595.276; // A4 portrait
const PAGE_H = 841.89;

// Table extents. The grid is flush left/right at these x values on every page.
const TABLE_L = 34.3;
const TABLE_R = 561.6;
const TABLE_BOTTOM = 34.24; // lowest row baseline grid line

// Column boundaries (x), left edge → right edge.
const COL_X = [34.3, 53.2, 133.2, 205.7, 258.2, 318.3, 430.7, 470.7, 561.6];
const C_NUM = 0, C_LAST = 1, C_FIRST = 2, C_NAT = 3, C_SIG = 7;

const CELL_PAD = 3.05; // text inset from a column's left edge
const ROW_H = 22;
const HEADER_H = 19.6;

// First page: the title block + info table sit above the participant table.
const P1_TABLE_TOP = 603.84;
// Continuation pages: participant table starts just below the top margin.
const PN_TABLE_TOP = 813.24;

const LINE_W = 0.5;
const BLACK = rgb(0, 0, 0);
const HEADER_FILL = rgb(0.90588, 0.90196, 0.90196); // #E7E6E6
const MID_GRAY = rgb(0.5, 0.5, 0.5);

// Font sizes, straight from the template.
const FS_TITLE = 14;
const FS_SUBTITLE = 12;
const FS_INFO = 7.5;
const FS_HEAD = 7;
const FS_CELL = 7;
const FS_DISC_HEAD = 6.5;
const FS_DISC = 6;
const FS_OPT = 6;

// Checkbox option geometry, measured per column. `box` is the square's x,
// `label` the x where the caption starts. Line 1 sits above line 2.
const BOX_SIZE = 5;
const OPT_LINE1_DY = 12.3; // baseline offset above the row's bottom grid line
const OPT_LINE2_DY = 6.1;
const CELL_TEXT_DY = 8.5; // single-line cell text baseline above the row bottom

const UNI_OPTS = [
  { value: "LMU", label: "LMU", box: 261.3, labelX: 268.95, line: 1 },
  { value: "TUM", label: "TUM", box: 284.946, labelX: 292.578, line: 1 },
  { value: "Other", label: "Other", box: 261.3, labelX: 268.95, line: 2 },
] as const;

const PROG_OPTS = [
  { value: "Erasmus+", label: "Erasmus+", box: 321.35, labelX: 329.0, line: 1 },
  { value: "LMUexchange", label: "LMUexchange", box: 359.492, labelX: 367.118, line: 1 },
  { value: "Full-time degree", label: "Full-time degree", box: 321.35, labelX: 329.0, line: 2 },
  { value: "Other", label: "Other", box: 375.692, labelX: 383.276, line: 2 },
] as const;

const ESN_OPTS = [
  { checked: true, label: "Yes", box: 433.8, labelX: 441.45, line: 1 },
  { checked: false, label: "No", box: 433.8, labelX: 441.45, line: 2 },
] as const;

const HEADERS = [
  { de: "#", en: "" },
  { de: "Nachname", en: "Surname" },
  { de: "Vorname", en: "First name" },
  { de: "Nationalität", en: "Nationality" },
  { de: "Universität", en: "University" },
  { de: "Austauschprogramm", en: "Exchange Program" },
  { de: "ESNcard", en: "" },
  { de: "Unterschrift", en: "Signature" },
];

// Disclaimer block, pre-wrapped exactly as the template breaks it.
const DISCLAIMER: Array<{ text: string; bold: boolean; gapBefore?: number }> = [
  { text: "HAFTUNGSAUSSCHLUSS", bold: true },
  {
    text:
      "Jegliche Haftung von MESA e.V. ist auf einer grob fahrlässigen Pflichtverletzung oder auf einer vorsätzlichen Pflichtverletzung seitens MESA e.V. beschränkt. Jede*r Teilnehmer*in ist volljährig und",
    bold: false,
  },
  {
    text:
      "komplett selbst verantwortlich für die eigenen Handlungen; für eventuelle hieraus entstehende Schäden ist MESA e.V. nicht haftbar. Die Teilnahme erfolgt auf eigene Gefahr.",
    bold: false,
  },
  { text: "DISCLAIMER", bold: true, gapBefore: 3.35 },
  {
    text:
      "The responsibility of MESA e.V. is limited to gross breach of duty or infringement on behalf of MESA e.V. Every participant is of legal full age and is fully responsible for his or her actions; MESA",
    bold: false,
  },
  {
    text:
      "e.V. is not responsible for damages caused by the participants. The participation in this event is at your own risk.",
    bold: false,
  },
  {
    text:
      "Alle nachfolgend aufgeführten Teilnehmenden sind Personen, die wir zu einem ERASMUS-Aufenthalt motiviert haben oder die sich für einen ERASMUS Aufenthalt in",
    bold: true,
    gapBefore: 3.45,
  },
  { text: "Europa interessieren.", bold: true },
];

/* Liberation Sans is metric-compatible with Arial/Helvetica (what the template
   is set in) but, unlike pdf-lib's built-in Helvetica, is not limited to
   WinAnsi — so names like "Čermák" or "Şahin" render instead of throwing. */
const FONT_DIR = path.join(process.cwd(), "lib", "pdf", "fonts");
let fontCache: { reg: Buffer; bold: Buffer } | null = null;

function loadFontBytes() {
  if (!fontCache) {
    fontCache = {
      reg: readFileSync(path.join(FONT_DIR, "LiberationSans-Regular.ttf")),
      bold: readFileSync(path.join(FONT_DIR, "LiberationSans-Bold.ttf")),
    };
  }
  return fontCache;
}

type Fonts = { reg: PDFFont; bold: PDFFont };

function colLeft(i: number) {
  return COL_X[i];
}
function colWidth(i: number) {
  return COL_X[i + 1] - COL_X[i];
}

function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Shorten `text` with an ellipsis until it fits `maxW` at `size`. */
function fitText(text: string, font: PDFFont, size: number, maxW: number): string {
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(text.slice(0, mid) + "…", size) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + "…" : "";
}

function hLine(page: PDFPage, y: number, x0 = TABLE_L, x1 = TABLE_R) {
  page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: LINE_W, color: BLACK });
}
function vLine(page: PDFPage, x: number, y0: number, y1: number) {
  page.drawLine({ start: { x, y: y0 }, end: { x, y: y1 }, thickness: LINE_W, color: BLACK });
}

/** Empty square, plus a tick when `checked`. */
function drawCheckbox(page: PDFPage, x: number, yBaseline: number, checked: boolean) {
  page.drawRectangle({
    x,
    y: yBaseline,
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderColor: BLACK,
    borderWidth: 0.45,
  });
  if (!checked) return;
  const p = 0.9;
  page.drawLine({
    start: { x: x + p, y: yBaseline + BOX_SIZE * 0.52 },
    end: { x: x + BOX_SIZE * 0.42, y: yBaseline + p },
    thickness: 0.8,
    color: BLACK,
  });
  page.drawLine({
    start: { x: x + BOX_SIZE * 0.42, y: yBaseline + p },
    end: { x: x + BOX_SIZE - p * 0.6, y: yBaseline + BOX_SIZE - p },
    thickness: 0.8,
    color: BLACK,
  });
}

/** Grey header band + the two-language column captions. Returns the y below it. */
function drawTableHeader(page: PDFPage, top: number, fonts: Fonts): number {
  const bottom = top - HEADER_H;

  for (let i = 0; i < HEADERS.length; i++) {
    page.drawRectangle({
      x: colLeft(i),
      y: bottom,
      width: colWidth(i),
      height: HEADER_H,
      color: HEADER_FILL,
    });
  }
  hLine(page, top);
  hLine(page, bottom);
  for (let i = 0; i < COL_X.length; i++) vLine(page, COL_X[i], bottom, top);

  for (let i = 0; i < HEADERS.length; i++) {
    const { de, en } = HEADERS[i];
    const cx = colLeft(i) + colWidth(i) / 2;
    const centered = (t: string) => cx - fonts.bold.widthOfTextAtSize(t, FS_HEAD) / 2;

    if (en) {
      page.drawText(de, { x: centered(de), y: bottom + 11.3, size: FS_HEAD, font: fonts.bold, color: BLACK });
      page.drawText(en, { x: centered(en), y: bottom + 3.25, size: FS_HEAD, font: fonts.bold, color: BLACK });
    } else {
      page.drawText(de, { x: centered(de), y: bottom + 7.3, size: FS_HEAD, font: fonts.bold, color: BLACK });
    }
  }
  return bottom;
}

/** Title, logo, event info table and the bilingual disclaimer. Returns table top y. */
function drawFirstPageHeader(page: PDFPage, event: Event, fonts: Fonts, logo: PDFImage | null): number {
  const title = "TEILNEHMENDENLISTE: MESA e.V.";
  page.drawText(title, { x: 39.5, y: 785.34, size: FS_TITLE, font: fonts.bold, color: BLACK });
  page.drawLine({
    start: { x: 39.5, y: 783.74 },
    end: { x: 39.5 + fonts.bold.widthOfTextAtSize(title, FS_TITLE), y: 783.74 },
    thickness: 0.8,
    color: BLACK,
  });
  page.drawText("(Münchner Erasmus Studenten Assoziation)", {
    x: 39.5,
    y: 771.14,
    size: FS_SUBTITLE,
    font: fonts.reg,
    color: BLACK,
  });

  if (logo) {
    page.drawImage(logo, { x: 447.2, y: 753.59, width: 108.75, height: 60 });
  }

  // ── Info table ───────────────────────────────────────────────────────────
  const ROW_A_TOP = 737.74, ROW_A_BOT = 716.24, ROW_B_BOT = 689.74, DISC_BOT = 619.84;

  hLine(page, ROW_A_TOP);
  hLine(page, ROW_A_BOT);
  hLine(page, ROW_B_BOT);
  hLine(page, DISC_BOT);
  vLine(page, TABLE_L, DISC_BOT, ROW_A_TOP);
  vLine(page, TABLE_R, DISC_BOT, ROW_A_TOP);
  vLine(page, 109.2, ROW_A_BOT, ROW_A_TOP);
  vLine(page, 457.9, ROW_A_BOT, ROW_A_TOP);
  vLine(page, 417.9, ROW_B_BOT, ROW_A_TOP);
  vLine(page, 154.3, ROW_B_BOT, ROW_A_BOT);
  vLine(page, 297.9, ROW_B_BOT, ROW_A_BOT);

  const label = (t: string, x: number, y: number) =>
    page.drawText(t, { x, y, size: FS_INFO, font: fonts.bold, color: BLACK });
  const value = (t: string, x: number, y: number, maxW: number) =>
    page.drawText(fitText(t, fonts.reg, FS_INFO, maxW), {
      x,
      y,
      size: FS_INFO,
      font: fonts.reg,
      color: BLACK,
    });

  label("Veranstaltung", 37.35, 724.34);
  value(event.title, 112.25, 724.34, 417.9 - 112.25 - CELL_PAD);
  label("Datum", 421.0, 724.34);
  value(formatDateLong(event.event_date), 460.95, 724.34, TABLE_R - 460.95 - CELL_PAD);

  label("Unterschrift verantwortliche*r", 37.35, 704.64);
  label("MESAnt*in", 37.35, 695.99);
  value(event.responsible_member ?? "", 157.35, 700.3, 297.9 - 157.35 - CELL_PAD);
  label("Unterschrift LEI-", 301.0, 704.64);
  label("Verantwortliche*r", 301.0, 695.99);
  value(event.lei_responsible ?? "", 420.95, 700.3, TABLE_R - 420.95 - CELL_PAD);

  // ── Disclaimer ───────────────────────────────────────────────────────────
  let y = 680.44;
  for (const line of DISCLAIMER) {
    if (line.gapBefore) y -= line.gapBefore;
    const size = line.bold ? FS_DISC_HEAD : FS_DISC;
    page.drawText(line.text, {
      x: 37.35,
      y,
      size,
      font: line.bold ? fonts.bold : fonts.reg,
      color: BLACK,
    });
    y -= line.bold ? 7.0 : 6.9;
  }

  return P1_TABLE_TOP;
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function generateAttendancePdf(
  event: Event,
  participants: Participant[],
  lang: Lang = DEFAULT_EXPORT_LANG
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = loadFontBytes();
  const fonts: Fonts = {
    reg: await pdfDoc.embedFont(fontBytes.reg, { subset: true }),
    bold: await pdfDoc.embedFont(fontBytes.bold, { subset: true }),
  };

  let logo: PDFImage | null = null;
  try {
    logo = await pdfDoc.embedPng(Buffer.from(ESN_LOGO_PNG_BASE64, "base64"));
  } catch {
    logo = null;
  }

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let rowTop = drawTableHeader(page, drawFirstPageHeader(page, event, fonts, logo), fonts);

  // Always print at least one page's worth of grid, so an empty list still
  // prints as a usable blank form.
  const rowCount = Math.max(
    participants.length,
    Math.floor((rowTop - TABLE_BOTTOM) / ROW_H)
  );

  for (let i = 0; i < rowCount; i++) {
    if (rowTop - ROW_H < TABLE_BOTTOM - 0.01) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      rowTop = drawTableHeader(page, PN_TABLE_TOP, fonts);
    }

    const bottom = rowTop - ROW_H;
    hLine(page, bottom);
    for (const x of COL_X) vLine(page, x, bottom, rowTop);

    const p: Participant | undefined = participants[i];
    const textY = bottom + CELL_TEXT_DY;
    const lineY = (n: 1 | 2) => bottom + (n === 1 ? OPT_LINE1_DY : OPT_LINE2_DY);

    // Row number, centred in the "#" column.
    const num = String(i + 1);
    page.drawText(num, {
      x: colLeft(C_NUM) + colWidth(C_NUM) / 2 - fonts.reg.widthOfTextAtSize(num, FS_CELL) / 2,
      y: textY,
      size: FS_CELL,
      font: fonts.reg,
      color: BLACK,
    });

    const textCell = (ci: number, text: string) => {
      if (!text) return;
      page.drawText(fitText(text, fonts.reg, FS_CELL, colWidth(ci) - 2 * CELL_PAD), {
        x: colLeft(ci) + CELL_PAD,
        y: textY,
        size: FS_CELL,
        font: fonts.reg,
        color: BLACK,
      });
    };

    textCell(C_LAST, p?.last_name ?? "");
    textCell(C_FIRST, p?.first_name ?? "");
    textCell(C_NAT, p ? countryName(p.nationality, lang) : "");

    for (const o of UNI_OPTS) {
      const y = lineY(o.line);
      drawCheckbox(page, o.box, y, p?.university === o.value);
      page.drawText(o.label, { x: o.labelX, y, size: FS_OPT, font: fonts.reg, color: BLACK });
    }
    for (const o of PROG_OPTS) {
      const y = lineY(o.line);
      drawCheckbox(page, o.box, y, p?.exchange_program === o.value);
      page.drawText(o.label, { x: o.labelX, y, size: FS_OPT, font: fonts.reg, color: BLACK });
    }
    for (const o of ESN_OPTS) {
      const y = lineY(o.line);
      drawCheckbox(page, o.box, y, p?.esn_card === o.checked);
      page.drawText(o.label, { x: o.labelX, y, size: FS_OPT, font: fonts.reg, color: BLACK });
    }

    if (p?.signature_url) {
      const bytes = await fetchImageBytes(p.signature_url);
      if (bytes) {
        try {
          const img = await pdfDoc.embedPng(bytes);
          const dims = img.scaleToFit(colWidth(C_SIG) - 2 * CELL_PAD, ROW_H - 4);
          page.drawImage(img, {
            x: colLeft(C_SIG) + (colWidth(C_SIG) - dims.width) / 2,
            y: bottom + (ROW_H - dims.height) / 2,
            width: dims.width,
            height: dims.height,
          });
        } catch {
          page.drawText("(Fehler)", {
            x: colLeft(C_SIG) + CELL_PAD,
            y: textY,
            size: FS_OPT,
            font: fonts.reg,
            color: MID_GRAY,
          });
        }
      }
    }

    rowTop = bottom;
  }

  return await pdfDoc.save();
}
