// Organisers sign finished events off with the number of people they
// counted: only the creator (or anyone for events without one), once, for
// themselves. The sign-off closes sign-ins, counts the optional details into
// events.stats and clears them in every sign-in.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ORGANISER,
  SIGNOUT_ORGANISER,
  admin,
  anonClient,
  clientAs,
  createEvent,
  deleteEvent,
  organiserSession,
  participantRow,
} from "../helpers/local";

let creator: SupabaseClient;
let colleague: SupabaseClient;
const anon = anonClient();
const cleanup: string[] = [];

beforeAll(async () => {
  creator = await clientAs((await organiserSession()).access_token);
  colleague = await clientAs((await organiserSession(SIGNOUT_ORGANISER)).access_token);
});
afterEach(async () => {
  for (const id of cleanup.splice(0)) await deleteEvent(id);
});

/** An event created through the API by `client` (so it is the creator), starting now. */
async function eventBy(client: SupabaseClient) {
  const { data, error } = await client
    .from("events")
    .insert({ title: "Sign-off test", event_date: new Date().toISOString(), public_token: crypto.randomUUID() })
    .select("id, public_token, created_by")
    .single();
  if (error) throw error;
  cleanup.push(data.id);
  return data;
}

function signOffAs(client: SupabaseClient, id: string, extra: object = {}) {
  return client
    .from("events")
    .update({ headcount: 3, signed_off_at: new Date().toISOString(), signed_off_by: "x", ...extra })
    .eq("id", id)
    .select("signed_off_at, signed_off_by, headcount, stats")
    .single();
}

describe("signing off", () => {
  it("the creator signs off with a headcount; the database records who and when", async () => {
    const ev = await eventBy(creator);
    expect(ev.created_by).toBe(ORGANISER.email);
    const before = Date.now();
    const { data, error } = await signOffAs(creator, ev.id, {
      signed_off_by: "someone-else@esnmesa.org",
      signed_off_at: "2000-01-01T00:00:00Z",
    });
    expect(error).toBeNull();
    expect(data!.signed_off_by).toBe(ORGANISER.email);
    expect(data!.headcount).toBe(3);
    expect(new Date(data!.signed_off_at!).getTime()).toBeGreaterThanOrEqual(before - 5000);
  });

  it("needs a headcount", async () => {
    const ev = await eventBy(creator);
    const { error } = await signOffAs(creator, ev.id, { headcount: null });
    expect(error?.code).toBe("23514");
    expect((await signOffAs(creator, ev.id, { headcount: -1 })).error).not.toBeNull();
  });

  it("other organisers cannot sign off someone else's event", async () => {
    const ev = await eventBy(creator);
    const { error } = await signOffAs(colleague, ev.id);
    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("Only the organiser who created the event");
  });

  it("events without a creator can be signed off by any organiser", async () => {
    const ev = await createEvent();
    cleanup.push(ev.id);
    const { data, error } = await signOffAs(colleague, ev.id);
    expect(error).toBeNull();
    expect(data!.signed_off_by).toBe(SIGNOUT_ORGANISER.email);
  });

  it("is final: no second sign-off, no undo, no new headcount", async () => {
    const ev = await eventBy(creator);
    await signOffAs(creator, ev.id);
    expect((await signOffAs(creator, ev.id)).error?.code).toBe("42501");
    const undo = await creator
      .from("events")
      .update({ signed_off_at: null, signed_off_by: null, headcount: null })
      .eq("id", ev.id);
    expect(undo.error?.code).toBe("42501");
    const recount = await creator.from("events").update({ headcount: 99 }).eq("id", ev.id);
    expect(recount.error?.code).toBe("42501");
  });

  it("the creator cannot be changed or faked", async () => {
    const ev = await eventBy(colleague);
    const steal = await creator.from("events").update({ created_by: ORGANISER.email }).eq("id", ev.id);
    expect(steal.error?.code).toBe("42501");

    // Inserting with someone else's name records the real creator, and a new event starts open
    const { data } = await creator
      .from("events")
      .insert({
        title: "Faked",
        event_date: new Date().toISOString(),
        public_token: crypto.randomUUID(),
        created_by: SIGNOUT_ORGANISER.email,
        signed_off_at: new Date().toISOString(),
        signed_off_by: ORGANISER.email,
        headcount: 5,
        stats: { signins: 500 },
      })
      .select("id, created_by, signed_off_at, headcount, stats")
      .single();
    cleanup.push(data!.id);
    expect(data).toMatchObject({ created_by: ORGANISER.email, signed_off_at: null, headcount: null, stats: null });
  });

  it("outsiders cannot sign off", async () => {
    const ev = await eventBy(creator);
    const { data } = await anon.from("events").update({ headcount: 1 }).eq("id", ev.id).select();
    expect(data ?? []).toEqual([]);
    const { data: row } = await admin.from("events").select("signed_off_at").eq("id", ev.id).single();
    expect(row!.signed_off_at).toBeNull();
  });
});

describe("statistics", () => {
  it("the sign-off counts the optional details and clears them in every sign-in", async () => {
    const ev = await eventBy(creator);
    await admin.from("participants").insert([
      participantRow(ev.id),
      participantRow(ev.id, { nationality: "DE", university: "LMU", esn_card: true }),
      participantRow(ev.id, { nationality: null, university: null, exchange_program: null, esn_card: null }),
    ]);

    const { data, error } = await signOffAs(creator, ev.id);
    expect(error).toBeNull();
    expect(data!.stats).toMatchObject({
      signins: 3,
      kiosk: 0,
      nationality: { IT: 1, DE: 1, not_given: 1 },
      university: { TUM: 1, LMU: 1, not_given: 1 },
      exchange_program: { "Erasmus+": 2, not_given: 1 },
      esn_card: { no: 1, yes: 1, not_given: 1 },
    });

    const { data: rows } = await admin
      .from("participants")
      .select("first_name, nationality, university, exchange_program, esn_card")
      .eq("event_id", ev.id);
    expect(rows).toHaveLength(3);
    for (const r of rows!) {
      expect(r).toMatchObject({ first_name: "Max", nationality: null, university: null, exchange_program: null, esn_card: null });
    }
  });

  it("organisers cannot write statistics themselves", async () => {
    const ev = await eventBy(creator);
    const { data } = await creator
      .from("events")
      .update({ stats: { signins: 999 } })
      .eq("id", ev.id)
      .select("stats")
      .single();
    expect(data!.stats).toBeNull();
  });

  it.each(["compute_event_stats", "clear_participant_details", "close_expired_lists"])(
    "%s cannot be called by visitors or organisers",
    async (fn) => {
      const ev = await eventBy(creator);
      for (const client of [anon, creator]) {
        const { error } = await client.rpc(fn, fn === "close_expired_lists" ? {} : { event: ev.id });
        expect(error?.code).toBe("42501");
      }
    }
  );
});

describe("responsible MESA member", () => {
  it("is the creator's Google name, whatever the request says", async () => {
    const { data } = await creator
      .from("events")
      .insert({
        title: "Responsible test",
        event_date: new Date().toISOString(),
        public_token: crypto.randomUUID(),
        responsible_member: "Someone Else",
      })
      .select("id, responsible_member")
      .single();
    cleanup.push(data!.id);
    expect(data).toMatchObject({ responsible_member: "Test Organiser" });
  });

  it("cannot be changed by editing the event", async () => {
    const ev = await eventBy(creator);
    const { data, error } = await creator
      .from("events")
      .update({ title: "Renamed", responsible_member: "Someone Else" })
      .eq("id", ev.id)
      .select("title, responsible_member")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ title: "Renamed", responsible_member: "Test Organiser" });
  });
});

describe("after the sign-off", () => {
  it("no new sign-ins, neither by QR code nor kiosk", async () => {
    const ev = await eventBy(creator);
    expect((await anon.from("participants").insert(participantRow(ev.id))).error).toBeNull();

    await signOffAs(creator, ev.id);
    const self = await anon.from("participants").insert(participantRow(ev.id));
    expect(self.error?.code).toBe("42501");
    const kiosk = await creator
      .from("participants")
      .insert(participantRow(ev.id, { entry_method: "kiosk", recorded_by: ORGANISER.email }));
    expect(kiosk.error?.code).toBe("42501");

    const { data } = await admin.from("participants").select("id").eq("event_id", ev.id);
    expect(data).toHaveLength(1);
  });

  it("the public form learns the event is closed", async () => {
    const ev = await eventBy(creator);
    await signOffAs(creator, ev.id);
    const { data } = await anon.rpc("get_public_event", { token: ev.public_token });
    expect(data[0].closed).toBe(true);
  });
});
