// The life of a list: sign-ins only inside the window (2 hours before the
// event until 24 hours after), names for organisers while it is open and for
// executives always, numbers for everyone, and the counts per answer once the
// list is closed.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EXECUTIVE,
  admin,
  anonClient,
  clientAs,
  closeList,
  createEvent,
  deleteEvent,
  forgedJwt,
  hoursFromNow,
  organiserSession,
  signIn,
} from "../helpers/local";

let organiser: SupabaseClient;
let executive: SupabaseClient;
const anon = anonClient();
const cleanup: string[] = [];

beforeAll(async () => {
  organiser = await clientAs((await organiserSession()).access_token);
  executive = await clientAs((await organiserSession(EXECUTIVE)).access_token);
});
afterAll(async () => {
  for (const id of cleanup) await deleteEvent(id);
});

/** An event starting `hours` from now (negative: in the past). */
async function eventAt(hours: number) {
  const ev = await createEvent(undefined, null, { event_date: hoursFromNow(hours) });
  cleanup.push(ev.id);
  return ev;
}

const names = async (client: SupabaseClient, eventId: string) =>
  (await client.from("participants").select("first_name").eq("event_id", eventId)).data ?? [];

describe("the sign-in window", () => {
  // [when, the event starts this many hours from now, sign-in allowed]
  it.each([
    ["from 2 hours before the event", 1.9, true],
    ["during the event", 0, true],
    ["until 24 hours after it", -23.9, true],
    ["not earlier than 2 hours before", 2.1, false],
    ["not later than 24 hours after", -24.1, false],
  ])("sign-ins work %s", async (_, hours, allowed) => {
    const ev = await eventAt(hours);
    const { error } = await signIn(anon, ev.id);
    if (allowed) expect(error).toBeNull();
    else expect(error?.code).toBe("42501");
  });

  it("the public form learns whether the list is closed", async () => {
    const upcoming = await eventAt(5);
    const past = await eventAt(-25);
    const { data: u } = await anon.rpc("get_public_event", { token: upcoming.public_token });
    const { data: p } = await anon.rpc("get_public_event", { token: past.public_token });
    expect(u[0].closed).toBe(false);
    expect(new Date(u[0].opens_at).getTime()).toBeGreaterThan(Date.now());
    expect(p[0].closed).toBe(true);
  });
});

describe("who sees the names", () => {
  it("organisers and executives while the list is open", async () => {
    const ev = await eventAt(0);
    await signIn(anon, ev.id, { first_name: "Open" });
    expect(await names(organiser, ev.id)).toEqual([{ first_name: "Open" }]);
    expect(await names(executive, ev.id)).toEqual([{ first_name: "Open" }]);
  });

  it("only executives once the list is closed", async () => {
    const ev = await eventAt(0);
    await signIn(anon, ev.id, { first_name: "Closed" });
    await closeList(ev.id);
    expect(await names(organiser, ev.id)).toEqual([]);
    expect(await names(executive, ev.id)).toEqual([{ first_name: "Closed" }]);
  });

  it("only executives once the list is signed off", async () => {
    const ev = await eventAt(0);
    await signIn(anon, ev.id);
    const { error } = await organiser.from("events").update({ headcount: 1 }).eq("id", ev.id);
    expect(error).toBeNull();
    expect(await names(organiser, ev.id)).toEqual([]);
    expect(await names(executive, ev.id)).toHaveLength(1);
  });

  it("is_executive answers for the signed-in user only", async () => {
    expect((await executive.rpc("is_executive")).data).toBe(true);
    expect((await organiser.rpc("is_executive")).data).toBe(false);
    expect((await anon.rpc("is_executive")).data).toBe(false);
    // The executive's address, but not signed in with Google: no Workspace account.
    expect((await (await clientAs(forgedJwt(EXECUTIVE.email, "email"))).rpc("is_executive")).data).toBe(false);
  });
});

describe("event_summary", () => {
  it("gives organisers the numbers of an open list, but no counts per answer yet", async () => {
    const ev = await eventAt(0);
    await signIn(anon, ev.id);
    await signIn(organiser, ev.id, { nationality: "FR", kiosk: true });
    const { data, error } = await organiser.rpc("event_summary", { event: ev.id });
    expect(error).toBeNull();
    expect(data).toMatchObject({ signins: 2, kiosk: 1 });
    expect(data.first_signin).toEqual(expect.any(String));
    expect(data).not.toHaveProperty("nationality");
  });

  it("adds the counts per answer once the list is closed", async () => {
    const ev = await eventAt(0);
    await signIn(anon, ev.id);
    await signIn(anon, ev.id, { nationality: "FR", university: null });
    await closeList(ev.id);
    const { data } = await organiser.rpc("event_summary", { event: ev.id });
    expect(data).toMatchObject({
      signins: 2,
      nationality: { IT: 1, FR: 1 },
      university: { TUM: 1, not_given: 1 },
      esn_card: { no: 2 },
    });
  });

  it("is empty for a list without sign-ins", async () => {
    const ev = await eventAt(-25);
    const { data } = await organiser.rpc("event_summary", { event: ev.id });
    expect(data).toEqual({ signins: 0, kiosk: 0, first_signin: null, last_signin: null });
  });

  it("tells visitors and outsiders nothing", async () => {
    const ev = await eventAt(0);
    for (const client of [anon, await clientAs(forgedJwt("someone@gmail.com"))]) {
      const { data } = await client.rpc("event_summary", { event: ev.id });
      expect(data ?? null).toBeNull();
    }
  });
});

describe("event_signin_counts", () => {
  it("gives organisers the number of sign-ins per event, also for closed lists", async () => {
    const ev = await eventAt(0);
    await signIn(anon, ev.id);
    await signIn(anon, ev.id);
    await closeList(ev.id);
    const { data } = await organiser.rpc("event_signin_counts");
    expect(data).toContainEqual({ event_id: ev.id, signins: 2 });
  });

  it("gives visitors nothing", async () => {
    const { data } = await anon.rpc("event_signin_counts");
    expect(data ?? []).toEqual([]);
  });
});

describe("executives table", () => {
  it("nobody reads or writes it through the API", async () => {
    for (const client of [anon, organiser, executive]) {
      const { data } = await client.from("executives").select("email");
      expect(data ?? []).toEqual([]);
      const { error } = await client.from("executives").insert({ email: "me@esnmesa.org" });
      expect(error).not.toBeNull();
    }
  });

  it.each(["replace_executives", "set_executive"])("%s is for the app's server only", async (fn) => {
    const args = fn === "replace_executives" ? { emails: ["me@esnmesa.org"] } : { member_email: "me@esnmesa.org", member: true };
    for (const client of [anon, organiser, executive]) {
      const { error } = await client.rpc(fn, args);
      expect(error?.code).toBe("42501");
    }
  });

  it("set_executive adds and removes one person", async () => {
    const email = "temp-exec@esnmesa.org";
    expect((await admin.rpc("set_executive", { member_email: email.toUpperCase(), member: true })).error).toBeNull();
    expect((await admin.from("executives").select("email").eq("email", email)).data).toEqual([{ email }]);
    await admin.rpc("set_executive", { member_email: email, member: false });
    expect((await admin.from("executives").select("email").eq("email", email)).data).toEqual([]);
  });

  it("replace_executives keeps exactly the group's esnmesa.org members", async () => {
    const { data, error } = await admin.rpc("replace_executives", {
      emails: [EXECUTIVE.email.toUpperCase(), " second@esnmesa.org ", "outsider@gmail.com"],
    });
    expect(error).toBeNull();
    expect(data).toBe(2);
    const { data: rows } = await admin.from("executives").select("email").order("email");
    expect(rows).toEqual([{ email: EXECUTIVE.email }, { email: "second@esnmesa.org" }]);
    // Back to the seed.
    await admin.rpc("replace_executives", { emails: [EXECUTIVE.email] });
  });
});
