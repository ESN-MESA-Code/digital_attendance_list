// Security: events (incl. organiser names) are readable by organisers only;
// the public form gets one event by token through get_public_event().
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ANON_KEY,
  ORGANISER,
  SUPABASE_URL,
  anonClient,
  clientAs,
  createEvent,
  deleteEvent,
  forgedJwt,
  organiserSession,
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

describe("reading events", () => {
  it("anonymous visitors see no events", async () => {
    const { data, error } = await anon.from("events").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anonymous visitors cannot find an event by its token directly", async () => {
    const { data } = await anon.from("events").select("*").eq("public_token", event.public_token);
    expect(data).toEqual([]);
  });

  it("signed-in non-Workspace accounts see no events", async () => {
    const { data } = await outsider.from("events").select("*");
    expect(data).toEqual([]);
  });

  it("a Workspace account with the wrong provider sees no events", async () => {
    const emailLogin = await clientAs(forgedJwt("someone@esnmesa.org", "email"));
    const { data } = await emailLogin.from("events").select("*");
    expect(data).toEqual([]);
  });

  it("organisers see events including the responsible names", async () => {
    const { data } = await organiser
      .from("events")
      .select("id, responsible_member, lei_responsible")
      .eq("id", event.id)
      .single();
    expect(data).toEqual({ id: event.id, responsible_member: "Rita Responsible", lei_responsible: "Lea LEI" });
  });

  it("the GraphQL endpoint respects the same rules", async () => {
    const res = await fetch(`${SUPABASE_URL}/graphql/v1`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ eventsCollection { edges { node { title responsible_member } } } }" }),
    });
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(body.data.eventsCollection.edges).toEqual([]);
  });
});

describe("get_public_event", () => {
  it("returns only id, title, description and date for the right token", async () => {
    const { data, error } = await anon.rpc("get_public_event", { token: event.public_token });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(Object.keys(data[0]).sort()).toEqual(["description", "event_date", "id", "title"]);
    expect(data[0]).toMatchObject({ id: event.id, title: event.title });
  });

  it.each(["", "nope", "%", "_".repeat(32), "' or '1'='1"])(
    "returns nothing for token %j",
    async (token) => {
      const { data, error } = await anon.rpc("get_public_event", { token });
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  );

  it("does not match a prefix of a real token", async () => {
    const { data } = await anon.rpc("get_public_event", { token: event.public_token.slice(0, 16) });
    expect(data).toEqual([]);
  });
});

describe("changing events", () => {
  const newEvent = { title: "Spam", event_date: new Date().toISOString(), public_token: crypto.randomUUID() };

  it("anonymous visitors cannot create, edit or delete events", async () => {
    expect((await anon.from("events").insert(newEvent)).error?.code).toBe("42501");
    const upd = await anon.from("events").update({ title: "Hacked" }).eq("id", event.id).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await anon.from("events").delete().eq("id", event.id).select();
    expect(del.data ?? []).toEqual([]);
    const { data } = await organiser.from("events").select("title").eq("id", event.id).single();
    expect(data?.title).toBe(event.title);
  });

  it("non-Workspace accounts cannot create, edit or delete events", async () => {
    expect((await outsider.from("events").insert(newEvent)).error?.code).toBe("42501");
    const upd = await outsider.from("events").update({ title: "Hacked" }).eq("id", event.id).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await outsider.from("events").delete().eq("id", event.id).select();
    expect(del.data ?? []).toEqual([]);
  });

  it("records the creating organiser's email in created_by", async () => {
    const created = await organiser.from("events").insert(newEvent).select("id, created_by").single();
    expect(created.error).toBeNull();
    try {
      expect(created.data!.created_by).toBe(ORGANISER.email);
    } finally {
      await deleteEvent(created.data!.id);
    }
  });

  it("events created with the service role have no creator", async () => {
    const { data } = await organiser.from("events").select("created_by").eq("id", event.id).single();
    expect(data).toEqual({ created_by: null });
  });

  it("non-organisers cannot read events or their creators", async () => {
    const created = await organiser.from("events").insert(newEvent).select("id").single();
    try {
      for (const client of [anon, outsider]) {
        const { data } = await client.from("events").select("id, created_by").eq("id", created.data!.id);
        expect(data ?? []).toEqual([]);
      }
    } finally {
      await deleteEvent(created.data!.id);
    }
  });

  it("organisers can create, edit and delete events", async () => {
    const created = await organiser.from("events").insert(newEvent).select("id").single();
    expect(created.error).toBeNull();
    const id = created.data!.id;
    const upd = await organiser.from("events").update({ title: "Renamed" }).eq("id", id).select("title").single();
    expect(upd.data?.title).toBe("Renamed");
    const del = await organiser.from("events").delete().eq("id", id).select("id");
    expect(del.data).toHaveLength(1);
  });
});
