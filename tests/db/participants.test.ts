// Security and data rules for participants: anyone may sign in through the
// form while the list is open, organisers read the names (never the optional
// details), nobody may change or delete rows.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ORGANISER,
  READABLE_COLUMNS,
  admin,
  anonClient,
  clientAs,
  createEvent,
  deleteEvent,
  forgedJwt,
  organiserSession,
  participantRow,
  type TestEvent,
} from "../helpers/local";

let event: TestEvent;
let organiser: SupabaseClient;
let outsider: SupabaseClient;
const anon = anonClient();

beforeAll(async () => {
  event = await createEvent();
  organiser = await clientAs((await organiserSession()).access_token);
  outsider = await clientAs(forgedJwt("someone@gmail.com"));
});
afterAll(() => deleteEvent(event.id));

const row = (extra: object = {}) => participantRow(event.id, extra);

async function countRows() {
  const { count } = await admin
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event.id);
  return count ?? 0;
}

describe("signing in through the public form", () => {
  it("anyone can add themselves", async () => {
    const before = await countRows();
    const { error } = await anon.from("participants").insert(row());
    expect(error).toBeNull();
    expect(await countRows()).toBe(before + 1);
  });

  it("the optional details can be left out", async () => {
    const { error } = await anon
      .from("participants")
      .insert(row({ nationality: null, university: null, exchange_program: null, esn_card: null }));
    expect(error).toBeNull();
  });

  it("but cannot read their own row back", async () => {
    const { error } = await anon.from("participants").insert(row()).select();
    expect(error?.code).toBe("42501");
  });

  it("cannot pretend to be a kiosk sign-in", async () => {
    const { error } = await anon
      .from("participants")
      .insert(row({ entry_method: "kiosk", recorded_by: ORGANISER.email }));
    expect(error?.code).toBe("42501");
  });

  it("cannot set recorded_by on a self sign-in", async () => {
    const { error } = await anon.from("participants").insert(row({ recorded_by: ORGANISER.email }));
    expect(error?.code).toBe("42501");
  });

  it("cannot sign in to an event that does not exist", async () => {
    const { error } = await anon.from("participants").insert(row({ event_id: crypto.randomUUID() }));
    // Refused by the insert policy (no open event with that id), before the foreign key.
    expect(error?.code).toBe("42501");
  });
});

describe("kiosk sign-ins", () => {
  it("organisers can record them under their own email", async () => {
    const { error } = await organiser
      .from("participants")
      .insert(row({ entry_method: "kiosk", recorded_by: ORGANISER.email.toUpperCase() }));
    expect(error).toBeNull();
  });

  it("organisers cannot record them under someone else's email", async () => {
    const { error } = await organiser
      .from("participants")
      .insert(row({ entry_method: "kiosk", recorded_by: "colleague@esnmesa.org" }));
    expect(error?.code).toBe("42501");
  });

  it("non-Workspace accounts cannot record them at all", async () => {
    const { error } = await outsider
      .from("participants")
      .insert(row({ entry_method: "kiosk", recorded_by: "someone@gmail.com" }));
    expect(error?.code).toBe("42501");
  });
});

describe("reading participants", () => {
  it("anonymous visitors see nobody", async () => {
    const { data } = await anon.from("participants").select("first_name");
    expect(data ?? []).toEqual([]);
  });

  it("non-Workspace accounts see nobody", async () => {
    const { data } = await outsider.from("participants").select("first_name");
    expect(data ?? []).toEqual([]);
  });

  it("organisers see the names of an open list", async () => {
    const { data, error } = await organiser.from("participants").select(READABLE_COLUMNS).eq("event_id", event.id);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data![0]).toMatchObject({ first_name: "Max", terms_version: "2026-10-23" });
  });

  it.each(["nationality", "university", "exchange_program", "esn_card", "*"])(
    "nobody reads %s per person, not even organisers",
    async (column) => {
      const { data, error } = await organiser.from("participants").select(column).eq("event_id", event.id);
      expect(error?.code).toBe("42501");
      expect(data).toBeNull();
    }
  );

  it("the signature column is gone", async () => {
    const { error } = await admin.from("participants").select("signature").limit(1);
    expect(error?.code).toBe("42703");
  });
});

describe("changing participants", () => {
  it.each([
    ["anonymous visitors", () => anon],
    ["non-Workspace accounts", () => outsider],
    ["organisers", () => organiser],
  ])("%s cannot edit or delete sign-ins", async (_, client) => {
    const before = await countRows();
    await client().from("participants").update({ first_name: "Changed" }).eq("event_id", event.id);
    await client().from("participants").delete().eq("event_id", event.id);
    expect(await countRows()).toBe(before);
    const { data } = await admin.from("participants").select("first_name").eq("first_name", "Changed");
    expect(data).toEqual([]);
  });
});

describe("validation", () => {
  it.each([
    ["an empty first name", { first_name: "" }],
    ["a 201-character last name", { last_name: "x".repeat(201) }],
    ["a country name instead of a code", { nationality: "Germany" }],
    ["a lower-case country code", { nationality: "de" }],
    ["an unknown university", { university: "Harvard" }],
    ["an unknown exchange programme", { exchange_program: "Party" }],
    ["an unknown entry method", { entry_method: "import" }],
    // Every sign-in records which notice and which terms were shown.
    ["no notice version", { notice_version: undefined }],
    ["a malformed notice version", { notice_version: "yes" }],
    ["no terms version", { terms_version: undefined }],
    ["a malformed terms version", { terms_version: "latest" }],
  ])("rejects %s", async (_, extra) => {
    const { error } = await anon.from("participants").insert(row(extra));
    expect(error).not.toBeNull();
  });
});
