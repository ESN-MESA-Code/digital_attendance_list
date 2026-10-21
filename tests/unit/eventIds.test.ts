import { describe, expect, it } from "vitest";
import { MAX_EXPORT_EVENTS, parseEventIds } from "@/lib/export/eventIds";

const a = "0b6c1a52-8e3f-4b1e-9a51-3d2f6c7e8a90";
const b = "1C2D3E4F-5A6B-4C7D-8E9F-0A1B2C3D4E5F";

describe("parseEventIds", () => {
  it("accepts comma-separated uuids, lower-cased and without duplicates", () => {
    expect(parseEventIds(`${a}, ${b},${a}`)).toEqual([a, b.toLowerCase()]);
  });

  it.each([null, "", ",", "nope", `${a},nope`, `${a}'--`, `${a},`])("rejects %j", (value) => {
    expect(parseEventIds(value)).toBeNull();
  });

  it(`allows at most ${MAX_EXPORT_EVENTS} events`, () => {
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`).join(",");
    expect(parseEventIds(ids(MAX_EXPORT_EVENTS))).toHaveLength(MAX_EXPORT_EVENTS);
    expect(parseEventIds(ids(MAX_EXPORT_EVENTS + 1))).toBeNull();
  });
});
