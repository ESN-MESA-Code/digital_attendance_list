// Organisers sign finished events off with the number of people they
// counted: only the creator (or anyone for events without one), once, for
// themselves. The sign-off closes sign-ins.
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
  signIn,
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
    .select("signed_off_at, signed_off_by, headcount")
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
      })
      .select("id, created_by, signed_off_at, headcount")
      .single();
    cleanup.push(data!.id);
    expect(data).toMatchObject({ created_by: ORGANISER.email, signed_off_at: null, headcount: null });
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
  it("events carry no counts an organiser could edit – they live in public.event_stats", async () => {
    const ev = await eventBy(creator);
    const { error } = await creator.from("events").update({ stats: { signins: 999 } }).eq("id", ev.id);
    expect(error).not.toBeNull();
  });
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
    expect((await signIn(anon, ev.id)).error).toBeNull();

    await signOffAs(creator, ev.id);
    const self = await signIn(anon, ev.id);
    expect(self.error?.code).toBe("42501");
    const kiosk = await signIn(creator, ev.id, { kiosk: true });
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
