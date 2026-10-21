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
    expect(fillPlaceholders("Mail {{dpo.email}}, {{ retention.years }} years")).toBe(
      `Mail ${LEGAL.dpo.email}, ${LEGAL.retention.years} years`
    );
  });

  it("fails on unknown placeholders", () => {
    expect(() => fillPlaceholders("{{dpo.phone}}")).toThrow("unknown placeholder {{dpo.phone}}");
    expect(() => fillPlaceholders("{{dpo}}")).toThrow();
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
        "form-consent.en",
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

  it("the consent version is a date", () => {
    expect(LEGAL.consent_version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("the form names the DPO and the retention period", () => {
    const { dataProcessing, consent } = attendanceFormTexts();
    expect(dataProcessing).toContain(`mailto:${LEGAL.dpo.email}`);
    expect(dataProcessing).toContain(`${LEGAL.retention.years}th year`);
    expect(consent).toMatch(/^I consent to/);
    expect(consent).not.toContain("<p>");
  });
});
