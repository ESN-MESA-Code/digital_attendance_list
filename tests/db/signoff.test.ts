// Organisers sign finished events off: only the creator (or anyone for
// events without one), once, for themselves. Signed-off events take no new
// sign-ins, and only signed-off lists can be filed.
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
import { sampleSignature } from "../helpers/png";

let creator: SupabaseClient;
let colleague: SupabaseClient;
let signature: string;
const anon = anonClient();
const cleanup: string[] = [];

beforeAll(async () => {
  creator = await clientAs((await organiserSession()).access_token);
  colleague = await clientAs((await organiserSession(SIGNOUT_ORGANISER)).access_token);
  signature = await sampleSignature();
});
afterEach(async () => {
  for (const id of cleanup.splice(0)) await deleteEvent(id);
});

/** An event created through the API by `client` (so it is the creator). */
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
    .update({ organiser_signature: signature, signed_off_at: new Date().toISOString(), signed_off_by: "x", ...extra })
    .eq("id", id)
    .select("signed_off_at, signed_off_by, organiser_signature")
    .single();
}

describe("signing off", () => {
  it("the creator signs off; the database records who and when", async () => {
    const ev = await eventBy(creator);
    expect(ev.created_by).toBe(ORGANISER.email);
    const before = Date.now();
    const { data, error } = await signOffAs(creator, ev.id, {
      signed_off_by: "someone-else@esnmesa.org",
      signed_off_at: "2000-01-01T00:00:00Z",
    });
    expect(error).toBeNull();
    expect(data!.signed_off_by).toBe(ORGANISER.email);
    expect(new Date(data!.signed_off_at!).getTime()).toBeGreaterThanOrEqual(before - 5000);
    expect(data!.organiser_signature).toBe(signature);
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

  it("is final: no second signature and no undo", async () => {
    const ev = await eventBy(creator);
    await signOffAs(creator, ev.id);
    expect((await signOffAs(creator, ev.id)).error?.code).toBe("42501");
    const undo = await creator
      .from("events")
      .update({ signed_off_at: null, signed_off_by: null, organiser_signature: null })
      .eq("id", ev.id);
    expect(undo.error?.code).toBe("42501");
  });

  it("needs a signature in the stored format", async () => {
    const ev = await eventBy(creator);
    expect((await signOffAs(creator, ev.id, { organiser_signature: null })).error).not.toBeNull();
    expect((await signOffAs(creator, ev.id, { organiser_signature: "https://evil.example/x.png" })).error).not.toBeNull();
  });

  it("the creator cannot be changed or faked", async () => {
    const ev = await eventBy(colleague);
    const steal = await creator.from("events").update({ created_by: ORGANISER.email }).eq("id", ev.id);
    expect(steal.error?.code).toBe("42501");

    // Inserting with someone else's name records the real creator
    const { data } = await creator
      .from("events")
      .insert({
        title: "Faked",
        event_date: new Date().toISOString(),
        public_token: crypto.randomUUID(),
        created_by: SIGNOUT_ORGANISER.email,
        signed_off_at: new Date().toISOString(),
        signed_off_by: ORGANISER.email,
        organiser_signature: signature,
      })
      .select("id, created_by, signed_off_at")
      .single();
    cleanup.push(data!.id);
    expect(data).toMatchObject({ created_by: ORGANISER.email, signed_off_at: null });
  });

  it("outsiders cannot sign off", async () => {
    const ev = await eventBy(creator);
    const { data } = await anon.from("events").update({ organiser_signature: signature }).eq("id", ev.id).select();
    expect(data ?? []).toEqual([]);
    const { data: row } = await admin.from("events").select("signed_off_at").eq("id", ev.id).single();
    expect(row!.signed_off_at).toBeNull();
  });
});

describe("after the sign-off", () => {
  it("no new sign-ins, neither by QR code nor kiosk", async () => {
    const ev = await eventBy(creator);
    expect((await anon.from("participants").insert(participantRow(ev.id, signature))).error).toBeNull();

    await signOffAs(creator, ev.id);
    const self = await anon.from("participants").insert(participantRow(ev.id, signature));
    expect(self.error?.code).toBe("42501");
    const kiosk = await creator
      .from("participants")
      .insert(participantRow(ev.id, signature, { entry_method: "kiosk", recorded_by: ORGANISER.email }));
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

  it("only signed-off lists can be filed", async () => {
    const ev = await eventBy(creator);
    const file = () =>
      creator
        .from("events")
        .update({ filed_at: new Date().toISOString(), filed_by: ORGANISER.email })
        .eq("id", ev.id);
    expect((await file()).error?.code).toBe("23514");
    await signOffAs(creator, ev.id);
    expect((await file()).error).toBeNull();
  });
});
