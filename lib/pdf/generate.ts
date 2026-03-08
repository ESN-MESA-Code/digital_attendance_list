import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Event, Participant } from "@/types";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 160;
const COL_WIDTHS = [110, 130, 120, 90, 80];
const COL_LABELS = ["Name", "Email", "Organization", "Signature", "Time"];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

export async function generateAttendancePdf(
  event: Event,
  participants: Participant[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  function addPage() {
    return pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  let page = addPage();
  let y = PAGE_HEIGHT - MARGIN;

  // --- Event Header ---
  page.drawText(truncate(event.title, 60), {
    x: MARGIN,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.5),
  });
  y -= 24;

  if (event.description) {
    const lines = wrapText(event.description, 80);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
    }
  }
  y -= 6;

  page.drawText(`Event Date: ${formatDate(event.event_date)}`, {
    x: MARGIN,
    y,
    size: 10,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 14;

  page.drawText(`Exported: ${formatDate(new Date().toISOString())}`, {
    x: MARGIN,
    y,
    size: 10,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 20;

  // Divider
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 16;

  // --- Table Header ---
  function drawTableHeader(p: ReturnType<typeof addPage>, startY: number) {
    let x = MARGIN;
    for (let i = 0; i < COL_LABELS.length; i++) {
      p.drawRectangle({
        x,
        y: startY - 18,
        width: COL_WIDTHS[i],
        height: 20,
        color: rgb(0.1, 0.1, 0.5),
      });
      p.drawText(COL_LABELS[i], {
        x: x + 4,
        y: startY - 14,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      x += COL_WIDTHS[i];
    }
    return startY - 18 - 4;
  }

  y = drawTableHeader(page, y);

  // --- Table Rows ---
  for (const participant of participants) {
    if (y - ROW_HEIGHT < MARGIN) {
      page = addPage();
      y = PAGE_HEIGHT - MARGIN;
      y = drawTableHeader(page, y);
    }

    const rowY = y - ROW_HEIGHT;

    // Row background (alternating)
    const idx = participants.indexOf(participant);
    if (idx % 2 === 0) {
      page.drawRectangle({
        x: MARGIN,
        y: rowY,
        width: PAGE_WIDTH - 2 * MARGIN,
        height: ROW_HEIGHT,
        color: rgb(0.97, 0.97, 0.97),
      });
    }

    // Row border
    page.drawRectangle({
      x: MARGIN,
      y: rowY,
      width: PAGE_WIDTH - 2 * MARGIN,
      height: ROW_HEIGHT,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 0.5,
    });

    let x = MARGIN;
    const textY = rowY + ROW_HEIGHT / 2 - 4;

    // Name
    page.drawText(truncate(participant.name, 18), {
      x: x + 4,
      y: textY,
      size: 8,
      font: fontRegular,
    });
    x += COL_WIDTHS[0];

    // Email
    page.drawText(truncate(participant.email ?? "", 22), {
      x: x + 4,
      y: textY,
      size: 8,
      font: fontRegular,
    });
    x += COL_WIDTHS[1];

    // Organization
    page.drawText(truncate(participant.organization ?? "", 20), {
      x: x + 4,
      y: textY,
      size: 8,
      font: fontRegular,
    });
    x += COL_WIDTHS[2];

    // Signature
    if (participant.signature_url) {
      const imgBytes = await fetchImageBytes(participant.signature_url);
      if (imgBytes) {
        try {
          const img = await pdfDoc.embedPng(imgBytes);
          const sigWidth = COL_WIDTHS[3] - 8;
          const sigHeight = ROW_HEIGHT - 8;
          const dims = img.scaleToFit(sigWidth, sigHeight);
          page.drawImage(img, {
            x: x + 4,
            y: rowY + (ROW_HEIGHT - dims.height) / 2,
            width: dims.width,
            height: dims.height,
          });
        } catch {
          page.drawText("(image error)", { x: x + 4, y: textY, size: 7, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
        }
      }
    }
    x += COL_WIDTHS[3];

    // Time
    const time = new Date(participant.created_at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    page.drawText(time, { x: x + 4, y: textY, size: 8, font: fontRegular });

    y = rowY;
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
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
