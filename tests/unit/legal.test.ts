// The legal texts in legal/*.md: every placeholder resolves, and the form
// texts say what the privacy notice promises.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGAL } from "@/lib/legal";
import { attendanceFormTexts, fillPlaceholders, legalHtml } from "@/lib/legalContent";

const texts = fs
  .readdirSync("legal")
  .filter((f) => f.endsWith(".md") && f !== "DATA_PROTECTION.md")
  .map((f) => f.replace(/\.md$/, ""));

describe("fillPlaceholders", () => {
  it("fills nested values", () => {
    expect(fillPlaceholders("Mail {{association.email}}, {{ retention.years }} years")).toBe(
      `Mail ${LEGAL.association.email}, ${LEGAL.retention.years} years`
    );
  });

  it("fails on unknown placeholders", () => {
    expect(() => fillPlaceholders("{{association.phone}}")).toThrow("unknown placeholder {{association.phone}}");
    expect(() => fillPlaceholders("{{association}}")).toThrow();
  });
});

describe("legal texts", () => {
  it("has the pages and form texts", () => {
    expect(texts).toEqual(
      expect.arrayContaining([
        "impressum",
        "privacy.en",
        "privacy.de",
        "form-disclaimer.en",
        "form-data-processing.en",
      ])
    );
  });

  it.each(texts)("%s renders with every placeholder filled", (name) => {
    const html = legalHtml(name);
    expect(html).not.toMatch(/\{\{|\}\}/);
    expect(html.length).toBeGreaterThan(100);
  });

  it("the example deletion year matches the retention period", () => {
    const { years, example_event_year, example_deletion_year } = LEGAL.retention;
    expect(example_deletion_year).toBe(example_event_year + years);
  });

  it("the notice version is a date", () => {
    expect(LEGAL.notice_version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("the form names the contact email and the retention period", () => {
    const { dataProcessing } = attendanceFormTexts();
    expect(dataProcessing).toContain(`mailto:${LEGAL.association.email}`);
    expect(dataProcessing).toContain(`end of the ${LEGAL.retention.years}th year after the event`);
    // Legitimate interest with a right to object – not consent.
    expect(dataProcessing).toContain("Art. 6(1)(f) GDPR");
    expect(dataProcessing).toMatch(/object to the processing/);
    expect(dataProcessing).not.toMatch(/consent/i);
  });
});
