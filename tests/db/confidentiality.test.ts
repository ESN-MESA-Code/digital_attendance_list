// Organisers accept the confidentiality rules before they see any list; the
// database records who accepted which version and when, and refuses
// organisers who have not accepted the current version.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEGAL } from "@/lib/legal";
import {
  NEW_ORGANISER,
  ORGANISER,
  admin,
  anonClient,
  clientAs,
  createEvent,
  deleteEvent,
  forgedJwt,
  organiserSession,
  resetNewOrganiser,
  type TestEvent,
} from "../helpers/local";

let newcomer: SupabaseClient;
let organiser: SupabaseClient;
let event: TestEvent;

beforeAll(async () => {
  await resetNewOrganiser();
  newcomer = await clientAs((await organiserSession(NEW_ORGANISER)).access_token);
  organiser = await clientAs((await organiserSession()).access_token);
  event = await createEvent();
});
afterAll(async () => {
  await deleteEvent(event.id);
  await resetNewOrganiser();
});

describe("organiser confidentiality", () => {
  it("the database asks for the version in legal/details.json", async () => {
    const { data } = await anonClient().rpc("confidentiality_version");
    expect(data).toBe(LEGAL.confidentiality_version);
  });

  it("an organiser who has not accepted sees no events and creates none", async () => {
    expect((await newcomer.rpc("is_workspace_member")).data).toBe(false);
    const { data } = await newcomer.from("events").select("id").eq("id", event.id);
    expect(data).toEqual([]);
    const { error } = await newcomer
      .from("events")
      .insert({ title: "x", event_date: new Date().toISOString(), public_token: crypto.randomUUID() });
    expect(error).not.toBeNull();
  });

  it("nobody writes acceptances directly", async () => {
    const { error } = await newcomer
      .from("organiser_acknowledgements")
      .insert({ email: NEW_ORGANISER.email, version: LEGAL.confidentiality_version });
    expect(error?.code).toBe("42501");
  });

  it("an outdated version is refused", async () => {
    const { error } = await newcomer.rpc("acknowledge_confidentiality", { accepted_version: "2000-01-01" });
    expect(error?.code).toBe("22023");
  });

  it("other accounts cannot accept", async () => {
    for (const client of [anonClient(), await clientAs(forgedJwt("someone@gmail.com"))]) {
      const { error } = await client.rpc("acknowledge_confidentiality", {
        accepted_version: LEGAL.confidentiality_version,
      });
      expect(error).not.toBeNull();
    }
  });

  it("after accepting, the organiser sees the lists; email and time come from the database", async () => {
    const before = Date.now();
    const { error } = await newcomer.rpc("acknowledge_confidentiality", {
      accepted_version: LEGAL.confidentiality_version,
    });
    expect(error).toBeNull();
    expect((await newcomer.rpc("is_workspace_member")).data).toBe(true);
    const { data: events } = await newcomer.from("events").select("id").eq("id", event.id);
    expect(events).toEqual([{ id: event.id }]);

    const { data: rows } = await newcomer.from("organiser_acknowledgements").select("*");
    expect(rows).toHaveLength(1);
    expect(rows![0].email).toBe(NEW_ORGANISER.email);
    expect(rows![0].version).toBe(LEGAL.confidentiality_version);
    expect(new Date(rows![0].accepted_at).getTime()).toBeGreaterThanOrEqual(before - 5000);
  });

  it("accepting again changes nothing", async () => {
    const { error } = await newcomer.rpc("acknowledge_confidentiality", {
      accepted_version: LEGAL.confidentiality_version,
    });
    expect(error).toBeNull();
    const { data } = await admin.from("organiser_acknowledgements").select("email").eq("email", NEW_ORGANISER.email);
    expect(data).toHaveLength(1);
  });

  it("organisers see only their own acceptance and cannot change or delete it", async () => {
    const { data } = await organiser.from("organiser_acknowledgements").select("email");
    expect(data).toEqual([{ email: ORGANISER.email }]);
    const update = await newcomer
      .from("organiser_acknowledgements")
      .update({ accepted_at: new Date(0).toISOString() })
      .eq("email", NEW_ORGANISER.email);
    expect(update.error?.code).toBe("42501");
    const del = await newcomer.from("organiser_acknowledgements").delete().eq("email", NEW_ORGANISER.email);
    expect(del.error?.code).toBe("42501");
  });

  it("the retention job cannot be called by visitors or organisers", async () => {
    for (const client of [anonClient(), organiser]) {
      const { error } = await client.rpc("delete_expired_acknowledgements");
      expect(error?.code).toBe("42501");
    }
  });

  it("the retention job deletes acceptances from before the fifth year back", async () => {
    const old = new Date(Date.UTC(new Date().getUTCFullYear() - 5, 0, 0)).toISOString();
    await admin.from("organiser_acknowledgements").update({ accepted_at: old }).eq("email", NEW_ORGANISER.email);
    const { error } = await admin.rpc("delete_expired_acknowledgements");
    expect(error).toBeNull();
    const { data } = await admin.from("organiser_acknowledgements").select("email").eq("email", NEW_ORGANISER.email);
    expect(data).toEqual([]);
    const { data: kept } = await admin.from("organiser_acknowledgements").select("email").eq("email", ORGANISER.email);
    expect(kept).toHaveLength(1);
  });
});
