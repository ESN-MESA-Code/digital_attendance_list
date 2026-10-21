// Security: live updates on the dashboard follow the same rules as reads –
// only organisers receive new sign-ins.
import { afterAll, beforeAll, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient,
  clientAs,
  createEvent,
  deleteEvent,
  forgedJwt,
  organiserSession,
  participantRow,
  type TestEvent,
} from "../helpers/local";
import { sampleSignature } from "../helpers/png";

let event: TestEvent;
const clients: SupabaseClient[] = [];
beforeAll(async () => {
  event = await createEvent();
});
afterAll(async () => {
  await Promise.all(clients.map((c) => c.removeAllChannels()));
  await deleteEvent(event.id);
});

async function listen(client: SupabaseClient) {
  clients.push(client);
  const received: Record<string, unknown>[] = [];
  await new Promise<void>((resolve, reject) => {
    client
      .channel(`participants:${event.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants", filter: `event_id=eq.${event.id}` },
        (payload) => received.push(payload.new)
      )
      // "SUBSCRIBED" comes before the database subscription is live; realtime
      // confirms that separately with a system message.
      .on("system", {}, (payload) => {
        if (payload.extension === "postgres_changes") {
          if (payload.status === "ok") resolve();
          else reject(new Error(payload.message));
        }
      })
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(err ?? new Error(status));
      });
  });
  return received;
}

it("only organisers receive new sign-ins, signature included", async () => {
  const organiser = await listen(await clientAs((await organiserSession()).access_token));
  const anon = await listen(anonClient());
  const outsider = await listen(await clientAs(forgedJwt("someone@gmail.com")));

  const signature = await sampleSignature();
  const { error } = await anonClient().from("participants").insert(participantRow(event.id, signature));
  expect(error).toBeNull();

  await expect.poll(() => organiser.length, { timeout: 15_000 }).toBe(1);
  expect(organiser[0].signature).toBe(signature);
  // Wait a little longer: nothing may arrive for the others.
  await new Promise((r) => setTimeout(r, 1500));
  expect(anon).toEqual([]);
  expect(outsider).toEqual([]);
});
