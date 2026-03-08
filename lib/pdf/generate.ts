import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import type { Event, Participant } from "@/types";

// ── A4 landscape for the wide participant table ─────────────────────────────
const PAGE_W = 841;   // A4 landscape width  (pt)
const PAGE_H = 595;   // A4 landscape height (pt)
const MARGIN  = 36;

// ESN brand colours (0–1 range)
const ESN_BLUE   = rgb(0.180, 0.192, 0.573); // #2E3192
const ESN_CYAN   = rgb(0.000, 0.682, 0.937); // #00AEEF
const BLACK      = rgb(0, 0, 0);
const DARK_GRAY  = rgb(0.2, 0.2, 0.2);
const MID_GRAY   = rgb(0.5, 0.5, 0.5);
const LIGHT_GRAY = rgb(0.93, 0.93, 0.93);
const WHITE      = rgb(1, 1, 1);

// Column widths (pts) — total must fit inside PAGE_W - 2*MARGIN = 769
// #(26) | Nachname(90) | Vorname(80) | Nat(72) | Uni(90) | Programme(122) | ESNcard(52) | Signature(147) | Time(50)
// sum = 26+90+80+72+90+122+52+147+50 = 729 pt  (40 pts spare for padding)
const COLS = [
  { label: "#",                      subLabel: "",                width: 26  },
  { label: "Nachname",               subLabel: "Surname",         width: 90  },
  { label: "Vorname",                subLabel: "First name",      width: 80  },
  { label: "Nationalität",           subLabel: "Nationality",     width: 72  },
  { label: "Universität",            subLabel: "University",      width: 90  },
  { label: "Austauschprogramm",      subLabel: "Exchange Programme", width: 122 },
  { label: "ESNcard",                subLabel: "",                width: 52  },
  { label: "Unterschrift",           subLabel: "Signature",       width: 147 },
  { label: "Zeit",                   subLabel: "Time",            width: 50  },
];
const ROW_H    = 52;
const HEADER_H = 28; // table header row height

function totalColWidth() {
  return COLS.reduce((s, c) => s + c.width, 0);
}

function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  });
}

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Draw a labelled info row (Veranstaltung, Datum, …) and return the new y. */
function drawInfoRow(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  rowH: number,
  contentW: number,
  fontBold: PDFFont,
  fontReg: PDFFont
): number {
  const labelW = 210;
  // border
  page.drawRectangle({ x, y: y - rowH, width: contentW, height: rowH, borderColor: BLACK, borderWidth: 0.6 });
  // divider between label and value
  page.drawLine({ start: { x: x + labelW, y }, end: { x: x + labelW, y: y - rowH }, thickness: 0.6, color: BLACK });
  // label text
  page.drawText(label, { x: x + 5, y: y - rowH + 8, size: 8.5, font: fontBold, color: BLACK });
  // value text
  page.drawText(truncate(value, 70), { x: x + labelW + 6, y: y - rowH + 8, size: 8.5, font: fontReg, color: DARK_GRAY });
  return y - rowH;
}

/** Draw the table header row and return the new y. */
function drawTableHeader(page: PDFPage, y: number, fontBold: PDFFont): number {
  let x = MARGIN;
  for (const col of COLS) {
    // header background
    page.drawRectangle({ x, y: y - HEADER_H, width: col.width, height: HEADER_H, color: ESN_BLUE });
    // column border
    page.drawRectangle({ x, y: y - HEADER_H, width: col.width, height: HEADER_H, borderColor: WHITE, borderWidth: 0.3 });
    // primary label
    page.drawText(col.label, { x: x + 3, y: y - 12, size: 6.5, font: fontBold, color: WHITE });
    // sub-label (italic would be nice but standard fonts don't support it — use smaller regular)
    if (col.subLabel) {
      page.drawText(col.subLabel, { x: x + 3, y: y - 21, size: 5.5, font: fontBold, color: rgb(0.8, 0.9, 1) });
    }
    x += col.width;
  }
  return y - HEADER_H;
}

export async function generateAttendancePdf(
  event: Event,
  participants: Participant[]
): Promise<Uint8Array> {
  const pdfDoc   = await PDFDocument.create();
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const contentW = PAGE_W - 2 * MARGIN;

  function addPage() {
    return pdfDoc.addPage([PAGE_W, PAGE_H]);
  }

  // ── PAGE 1 HEADER ──────────────────────────────────────────────────────────
  let page = addPage();
  let y = PAGE_H - MARGIN;

  // ESN branding block
  page.drawRectangle({ x: MARGIN, y: y - 28, width: 120, height: 28, color: ESN_BLUE });
  page.drawText("ESN", { x: MARGIN + 30, y: y - 20, size: 18, font: fontBold, color: WHITE });
  page.drawText("✦", { x: MARGIN + 6,  y: y - 22, size: 16, font: fontBold, color: ESN_CYAN });
  page.drawText("Erasmus Student Network", { x: MARGIN,      y: y - 40, size: 7, font: fontReg,  color: DARK_GRAY });
  page.drawText("MESA München",            { x: MARGIN,      y: y - 50, size: 7.5, font: fontBold, color: ESN_BLUE });
  y -= 62;

  // Title
  page.drawText("TEILNEHMENDENLISTE: MESA e.V.", {
    x: MARGIN, y, size: 16, font: fontBold, color: BLACK,
  });
  y -= 18;
  page.drawText("(Münchner Erasmus Studenten Assoziation)", {
    x: MARGIN, y, size: 12, font: fontReg, color: DARK_GRAY,
  });
  y -= 18;

  // Thin horizontal rule
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.8, color: MID_GRAY });
  y -= 10;

  // ── INFO TABLE ─────────────────────────────────────────────────────────────
  const INFO_ROW_H = 22;
  y = drawInfoRow(page, "Veranstaltung",                       event.title,
                  MARGIN, y, INFO_ROW_H, contentW, fontBold, fontReg);
  y = drawInfoRow(page, "Datum",                               formatDateLong(event.event_date),
                  MARGIN, y, INFO_ROW_H, contentW, fontBold, fontReg);
  y = drawInfoRow(page, "Unterschrift verantwortliche*r MESAnt*in", event.responsible_member ?? "",
                  MARGIN, y, INFO_ROW_H, contentW, fontBold, fontReg);
  y = drawInfoRow(page, "Unterschrift LEI-Verantwortliche*r",  event.lei_responsible ?? "",
                  MARGIN, y, INFO_ROW_H, contentW, fontBold, fontReg);
  y -= 10;

  // ── DISCLAIMER BOX ─────────────────────────────────────────────────────────
  const DISC_LINES = [
    { bold: true,  text: "HAFTUNGSAUSSCHLUSS" },
    { bold: false, text: "Jegliche Haftung von MESA e.V. ist auf einer grob fahrlässigen Pflichtverletzung oder auf einer vorsätzlichen Pflichtverletzung seitens" },
    { bold: false, text: "MESA e.V. beschränkt. Jede*r Teilnehmer*in ist volljährig und komplett selbst verantwortlich für die eigenen Handlungen; für eventuelle" },
    { bold: false, text: "hieraus entstehende Schäden ist MESA e.V. nicht haftbar. Die Teilnahme erfolgt auf eigene Gefahr." },
    { bold: true,  text: "" },
    { bold: true,  text: "DISCLAIMER" },
    { bold: false, text: "The responsibility of MESA e.V. is limited to gross breach of duty or infringement on behalf of MESA e.V. Every participant is of legal" },
    { bold: false, text: "full age and is fully responsible for his or her actions; MESA e.V. is not responsible for damages caused by the participants." },
    { bold: false, text: "The participation in this event is at your own risk." },
    { bold: true,  text: "" },
    { bold: true,  text: "Alle nachfolgend aufgeführten Teilnehmenden sind Personen, die wir zu einem ERASMUS-Aufenthalt motiviert haben oder die sich für" },
    { bold: true,  text: "einen ERASMUS Aufenthalt in Europa interessieren." },
  ];
  const lineH    = 9;
  const boxH     = DISC_LINES.length * lineH + 10;
  page.drawRectangle({ x: MARGIN, y: y - boxH, width: contentW, height: boxH, borderColor: BLACK, borderWidth: 0.6 });
  let dy = y - 7;
  for (const dl of DISC_LINES) {
    page.drawText(dl.text, { x: MARGIN + 5, y: dy, size: 6.5, font: dl.bold ? fontBold : fontReg, color: BLACK });
    dy -= lineH;
  }
  y = y - boxH - 10;

  // ── PARTICIPANT TABLE ───────────────────────────────────────────────────────
  y = drawTableHeader(page, y, fontBold);

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];

    // New page if not enough room
    if (y - ROW_H < MARGIN) {
      page = addPage();
      y = PAGE_H - MARGIN;
      y = drawTableHeader(page, y, fontBold);
    }

    const rowY = y - ROW_H;

    // Alternating row bg
    if (i % 2 === 0) {
      page.drawRectangle({ x: MARGIN, y: rowY, width: totalColWidth(), height: ROW_H, color: LIGHT_GRAY });
    }
    // Row border
    page.drawRectangle({ x: MARGIN, y: rowY, width: totalColWidth(), height: ROW_H,
                         borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4 });

    let x = MARGIN;
    const midY = rowY + ROW_H / 2 - 4;

    // Helper to draw a cell with a vertical right divider
    const cell = (text: string, w: number, opts?: { size?: number }) => {
      page.drawText(text, { x: x + 3, y: midY, size: opts?.size ?? 7.5, font: fontReg, color: BLACK });
      page.drawLine({ start: { x: x + w, y: rowY }, end: { x: x + w, y: rowY + ROW_H },
                      thickness: 0.3, color: rgb(0.75, 0.75, 0.75) });
      x += w;
    };

    // # (row number)
    cell(String(i + 1), COLS[0].width, { size: 7 });

    // Nachname
    cell(truncate(p.last_name, 14), COLS[1].width);

    // Vorname
    cell(truncate(p.first_name, 13), COLS[2].width);

    // Nationalität
    cell(truncate(p.nationality ?? "", 12), COLS[3].width);

    // Universität — show checkmark-style
    const uniW   = COLS[4].width;
    const uniCol = x;
    const uniOptions: Array<"LMU" | "TUM" | "Other"> = ["LMU", "TUM", "Other"];
    for (let r = 0; r < uniOptions.length; r++) {
      const optY = rowY + ROW_H - 12 - r * 14;
      const checked = p.university === uniOptions[r];
      page.drawText(checked ? "■" : "□", { x: uniCol + 3, y: optY, size: 7, font: fontReg, color: BLACK });
      page.drawText(uniOptions[r], { x: uniCol + 12, y: optY, size: 6.5, font: fontReg, color: BLACK });
    }
    page.drawLine({ start: { x: uniCol + uniW, y: rowY }, end: { x: uniCol + uniW, y: rowY + ROW_H },
                    thickness: 0.3, color: rgb(0.75, 0.75, 0.75) });
    x += uniW;

    // Austauschprogramm
    const progW   = COLS[5].width;
    const progCol = x;
    const progOptions: Array<"Erasmus+" | "LMUexchange" | "Full-time degree" | "Other"> =
      ["Erasmus+", "LMUexchange", "Full-time degree", "Other"];
    for (let r = 0; r < progOptions.length; r++) {
      const optY = rowY + ROW_H - 12 - r * 11;
      const checked = p.exchange_program === progOptions[r];
      page.drawText(checked ? "■" : "□", { x: progCol + 3,  y: optY, size: 7,   font: fontReg, color: BLACK });
      page.drawText(progOptions[r],       { x: progCol + 12, y: optY, size: 6.5, font: fontReg, color: BLACK });
    }
    page.drawLine({ start: { x: progCol + progW, y: rowY }, end: { x: progCol + progW, y: rowY + ROW_H },
                    thickness: 0.3, color: rgb(0.75, 0.75, 0.75) });
    x += progW;

    // ESNcard Yes/No
    const esnW   = COLS[6].width;
    const esnCol = x;
    const yesChecked = p.esn_card === true;
    const noChecked  = p.esn_card === false;
    page.drawText(yesChecked ? "■" : "□", { x: esnCol + 3,  y: midY + 6, size: 7, font: fontReg, color: BLACK });
    page.drawText("Yes",                   { x: esnCol + 12, y: midY + 6, size: 6.5, font: fontReg, color: BLACK });
    page.drawText(noChecked  ? "■" : "□", { x: esnCol + 3,  y: midY - 6, size: 7, font: fontReg, color: BLACK });
    page.drawText("No",                    { x: esnCol + 12, y: midY - 6, size: 6.5, font: fontReg, color: BLACK });
    page.drawLine({ start: { x: esnCol + esnW, y: rowY }, end: { x: esnCol + esnW, y: rowY + ROW_H },
                    thickness: 0.3, color: rgb(0.75, 0.75, 0.75) });
    x += esnW;

    // Signature image
    const sigW   = COLS[7].width;
    const sigCol = x;
    if (p.signature_url) {
      const imgBytes = await fetchImageBytes(p.signature_url);
      if (imgBytes) {
        try {
          const img      = await pdfDoc.embedPng(imgBytes);
          const maxSigW  = sigW - 6;
          const maxSigH  = ROW_H - 8;
          const dims     = img.scaleToFit(maxSigW, maxSigH);
          page.drawImage(img, {
            x:      sigCol + 3,
            y:      rowY + (ROW_H - dims.height) / 2,
            width:  dims.width,
            height: dims.height,
          });
        } catch {
          page.drawText("(error)", { x: sigCol + 3, y: midY, size: 6, font: fontReg, color: MID_GRAY });
        }
      }
    }
    page.drawLine({ start: { x: sigCol + sigW, y: rowY }, end: { x: sigCol + sigW, y: rowY + ROW_H },
                    thickness: 0.3, color: rgb(0.75, 0.75, 0.75) });
    x += sigW;

    // Zeit (time)
    const timeStr = new Date(p.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    cell(timeStr, COLS[8].width, { size: 7 });

    y = rowY;
  }

  return await pdfDoc.save();
}
