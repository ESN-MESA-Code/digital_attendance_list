import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { generateAttendancePdf, generateCombinedAttendancePdf } from "@/lib/pdf/generate";
import type { Event, Participant } from "@/types";
import { sampleSignature } from "../helpers/png";

const event: Event = {
  id: "e1",
  title: "Stammtisch",
  description: "",
  event_date: "2026-10-21T18:00:00Z",
  responsible_member: "Rita Responsible",
  lei_responsible: "Lea LEI",
  public_token: "t",
  created_by: null,
  filed_at: null,
  filed_by: null,
  created_at: "2026-10-01T00:00:00Z",
};

function participant(i: number, signature: string): Participant {
  return {
    id: `p${i}`,
    event_id: "e1",
    first_name: i % 2 ? "Şahin" : "Zoë",
    last_name: `Čermák-${i}`,
    nationality: "TR",
    university: "LMU",
    exchange_program: "Erasmus+",
    esn_card: i % 2 === 0,
    signature,
    entry_method: "self",
    recorded_by: null,
    created_at: "2026-10-21T18:05:00Z",
  };
}

async function load(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const images = doc.context
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream && obj.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"));
  return { doc, imageCount: images.length };
}

describe("generateAttendancePdf", () => {
  // Image objects of the logo alone (it has an alpha channel, so more than one).
  let logoImages = 0;
  let empty: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    empty = await load(await generateAttendancePdf(event, []));
    logoImages = empty.imageCount;
  });

  it("prints an empty list as one blank form page with the logo", () => {
    expect(empty.doc.getPageCount()).toBe(1);
    expect(logoImages).toBeGreaterThan(0);
  });

  it("embeds every stored signature and adds pages as needed", async () => {
    const sig = await sampleSignature();
    const people = Array.from({ length: 40 }, (_, i) => participant(i, sig));
    const { doc, imageCount } = await load(await generateAttendancePdf(event, people));
    expect(doc.getPageCount()).toBe(2);
    expect(imageCount).toBe(logoImages + 40);
  });

  it("skips signatures that are not PNG data URLs instead of fetching them", async () => {
    const people = [
      participant(1, "https://example.com/old-storage-url.png"),
      participant(2, "data:image/png;base64,bm90IGEgcG5n"), // "not a png"
    ];
    const { imageCount } = await load(await generateAttendancePdf(event, people));
    expect(imageCount).toBe(logoImages);
  });
});

describe("generateCombinedAttendancePdf", () => {
  it("puts each event's pages one after another, each starting a new page", async () => {
    const sig = await sampleSignature();
    const other: Event = { ...event, id: "e2", title: "Pub crawl" };
    const third: Event = { ...event, id: "e3", title: "Museum" };
    const lists = [
      { event, participants: [] },
      // Two pages: more people than fit on the first page.
      { event: other, participants: Array.from({ length: 40 }, (_, i) => participant(i, sig)) },
      { event: third, participants: [participant(1, sig)] },
    ];
    const combined = await load(await generateCombinedAttendancePdf(lists));

    // The same as the single exports back to back.
    const singles = await Promise.all(
      lists.map(async (l) => (await load(await generateAttendancePdf(l.event, l.participants))).doc.getPageCount())
    );
    expect(singles).toEqual([1, 2, 1]);
    expect(combined.doc.getPageCount()).toBe(4);
    // The logo is embedded once and shared; one image per signature.
    const { imageCount: logoOnly } = await load(await generateCombinedAttendancePdf([{ event, participants: [] }]));
    expect(combined.imageCount).toBe(logoOnly + 41);
  });
});
