import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetSavedDetails, loadSavedDetails, saveDetails, type SavedDetails } from "@/lib/savedDetails";

// Minimal browser cookie jar: enough of document.cookie for these helpers.
class CookieJar {
  jar = new Map<string, string>();
  writes: string[] = [];
  get cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  set cookie(line: string) {
    this.writes.push(line);
    const [pair, ...attrs] = line.split("; ");
    const i = pair.indexOf("=");
    const name = pair.slice(0, i);
    if (attrs.some((a) => a === "Max-Age=0")) this.jar.delete(name);
    else this.jar.set(name, pair.slice(i + 1));
  }
}

const details: SavedDetails = {
  first_name: "Jane",
  last_name: "Doe; =evil",
  nationality: "FR",
  university: "LMU",
  exchange_program: "Erasmus+",
  esn_card: "yes",
};

let jar: CookieJar;
beforeEach(() => {
  jar = new CookieJar();
  Object.assign(globalThis, { document: jar, location: { protocol: "https:" } });
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).document;
  delete (globalThis as Record<string, unknown>).location;
});

describe("saved details cookie", () => {
  it("round-trips the details, including awkward characters", () => {
    saveDetails(details);
    expect(loadSavedDetails()).toEqual(details);
  });

  it("returns null when nothing is saved", () => {
    expect(loadSavedDetails()).toBeNull();
  });

  it("returns null for a corrupt cookie", () => {
    jar.jar.set("mesa_attendance_details", "%7Bnot-json");
    expect(loadSavedDetails()).toBeNull();
  });

  it("forgets the details", () => {
    saveDetails(details);
    forgetSavedDetails();
    expect(loadSavedDetails()).toBeNull();
  });

  it("is Secure on https, SameSite=Lax and expires after a year", () => {
    saveDetails(details);
    const line = jar.writes.at(-1)!;
    expect(line).toContain("; Secure");
    expect(line).toContain("SameSite=Lax");
    expect(line).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
  });
});
