// Security and data rules for sign-ins: anyone may sign in through
// public.sign_in() while the list is open; the optional answers are only
// counted, never stored with the name; nobody may change or delete rows.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ORGANISER,
  admin,
  anonClient,
  clientAs,
  createEvent,
  deleteEvent,
  forgedJwt,
  organiserSession,
  participantRow,
  signIn,
  statsOf,
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

async function countRows(eventId = event.id) {
  const { count } = await admin
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}

describe("signing in through the public form", () => {
  it("anyone can sign in; the answers are counted, not stored with the name", async () => {
    const ev = await createEvent();
    try {
      const { error } = await signIn(anon, ev.id, { first_name: "Erika" });
      expect(error).toBeNull();

      const { data: rows } = await admin.from("participants").select("*").eq("event_id", ev.id);
      expect(rows).toHaveLength(1);
      expect(rows![0]).toMatchObject({ first_name: "Erika", entry_method: "self", recorded_by: null, terms_version: "2026-10-23" });
      for (const column of ["nationality", "university", "exchange_program", "esn_card", "signature"]) {
        expect(rows![0]).not.toHaveProperty(column);
      }

      expect(await statsOf(ev.id)).toEqual({
        nationality: { IT: 1 },
        university: { TUM: 1 },
        exchange_program: { "Erasmus+": 1 },
        esn_card: { no: 1 },
      });
    } finally {
      await deleteEvent(ev.id);
    }
  });

  it("counts left-out answers as not given and adds up", async () => {
    const ev = await createEvent();
    try {
      await signIn(anon, ev.id);
      await signIn(anon, ev.id, { nationality: "DE", esn_card: true });
      const { error } = await signIn(anon, ev.id, {
        nationality: "",
        university: null,
        exchange_program: undefined,
        esn_card: null,
      });
      expect(error).toBeNull();
      expect(await statsOf(ev.id)).toEqual({
        nationality: { IT: 1, DE: 1, not_given: 1 },
        university: { TUM: 2, not_given: 1 },
        exchange_program: { "Erasmus+": 2, not_given: 1 },
        esn_card: { no: 1, yes: 1, not_given: 1 },
      });
    } finally {
      await deleteEvent(ev.id);
    }
  });

  it("cannot insert into participants directly", async () => {
    const { error } = await anon.from("participants").insert(participantRow(event.id));
    expect(error?.code).toBe("42501");
  });

  it("cannot pretend to be a kiosk sign-in", async () => {
    const { error } = await signIn(anon, event.id, { kiosk: true });
    expect(error?.code).toBe("42501");
  });

  it("cannot sign in to an event that does not exist", async () => {
    const { error } = await signIn(anon, crypto.randomUUID());
    expect(error?.code).toBe("42501");
  });
});

describe("kiosk sign-ins", () => {
  it("organisers record them; the database takes their email from the session", async () => {
    const before = await countRows();
    const { error } = await signIn(organiser, event.id, { kiosk: true, first_name: "Kiosk" });
    expect(error).toBeNull();
    expect(await countRows()).toBe(before + 1);
    const { data } = await admin.from("participants").select("entry_method, recorded_by").eq("first_name", "Kiosk").eq("event_id", event.id);
    expect(data).toEqual([{ entry_method: "kiosk", recorded_by: ORGANISER.email }]);
  });

  it("non-Workspace accounts cannot record them", async () => {
    const { error } = await signIn(outsider, event.id, { kiosk: true });
    expect(error?.code).toBe("42501");
  });
});

describe("reading participants", () => {
  it("anonymous visitors see nobody", async () => {
    await signIn(anon, event.id);
    const { data } = await anon.from("participants").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("non-Workspace accounts see nobody", async () => {
    const { data } = await outsider.from("participants").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("organisers see the names of an open list", async () => {
    const { data, error } = await organiser.from("participants").select("*").eq("event_id", event.id);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data![0]).toMatchObject({ first_name: expect.any(String), terms_version: "2026-10-23" });
  });

  it("nobody reads the counts through the API", async () => {
    for (const client of [anon, outsider, organiser]) {
      const { data } = await client.from("event_stats").select("*");
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("changing sign-ins and counts", () => {
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

  it.each([
    ["anonymous visitors", () => anon],
    ["organisers", () => organiser],
  ])("%s cannot write counts", async (_, client) => {
    const before = await statsOf(event.id);
    await client().from("event_stats").insert({ event_id: event.id, question: "nationality", answer: "XX", total: 99 });
    await client().from("event_stats").update({ total: 999 }).eq("event_id", event.id);
    expect(await statsOf(event.id)).toEqual(before);
  });
});

describe("validation", () => {
  it.each([
    ["an empty first name", { first_name: "" }],
    ["no last name", { last_name: null }],
    ["a 201-character last name", { last_name: "x".repeat(201) }],
    ["a country name instead of a code", { nationality: "Germany" }],
    ["a lower-case country code", { nationality: "de" }],
    ["an unknown university", { university: "Harvard" }],
    ["an unknown exchange programme", { exchange_program: "Party" }],
    // Every sign-in records which notice and which terms were shown.
    ["no notice version", { notice_version: null }],
    ["a malformed notice version", { notice_version: "yes" }],
    ["no terms version", { terms_version: null }],
    ["a malformed terms version", { terms_version: "latest" }],
  ])("rejects %s, and counts nothing", async (_, extra) => {
    const ev = await createEvent();
    try {
      const { error } = await signIn(anon, ev.id, extra);
      expect(error).not.toBeNull();
      expect(await countRows(ev.id)).toBe(0);
      expect(await statsOf(ev.id)).toEqual({});
    } finally {
      await deleteEvent(ev.id);
    }
  });
});
