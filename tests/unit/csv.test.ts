import { describe, expect, it } from "vitest";
import { escapeCSV } from "@/lib/csv";

describe("escapeCSV", () => {
  it("leaves plain values alone", () => {
    expect(escapeCSV("Mustermann")).toBe("Mustermann");
    expect(escapeCSV("Čermák")).toBe("Čermák");
  });

  it("turns null and undefined into empty cells", () => {
    expect(escapeCSV(null)).toBe("");
    expect(escapeCSV(undefined)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(escapeCSV("Doe, Jane")).toBe('"Doe, Jane"');
    expect(escapeCSV('Jane "JJ" Doe')).toBe('"Jane ""JJ"" Doe"');
    expect(escapeCSV("a\nb")).toBe('"a\nb"');
    expect(escapeCSV("a\rb")).toBe('"a\rb"');
  });

  describe("security: spreadsheet formula injection", () => {
    it.each([
      "=HYPERLINK(\"https://evil.example\",\"click\")",
      "+1+cmd|' /C calc'!A0",
      "-2+3",
      "@SUM(A1:A9)",
      "\t=1+1",
      "\r=1+1",
    ])("neutralises %j", (value) => {
      const cell = escapeCSV(value);
      // A spreadsheet only runs a formula when the cell starts with one of these
      const unquoted = cell.startsWith('"') ? cell.slice(1) : cell;
      expect(unquoted.startsWith("'")).toBe(true);
    });

    it("still quotes neutralised values that need it", () => {
      expect(escapeCSV("=1,2")).toBe("\"'=1,2\"");
    });
  });
});
