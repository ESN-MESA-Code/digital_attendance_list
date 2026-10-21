// Privacy: events and their sign-ins are deleted at the end of the tenth
// calendar year after the event, as the privacy notice promises.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  clientAs,
  createEvent,
  deleteEvent,
  organiserSession,
  participantRow,
  type TestEvent,
} from "../helpers/local";
import { sampleSignature } from "../helpers/png";

const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
const yearsBefore = (years: number, days: number) =>
  new Date(Date.UTC(startOfYear.getUTCFullYear() - years, 0, 1 + days)).toISOString();

let expired: TestEvent;
let kept: TestEvent;

beforeAll(async () => {
  // The last day of the eleventh year back is past retention; the first day
  // of the tenth year back is kept until that year's end plus ten years.
  expired = await createEvent(undefined, null, { event_date: yearsBefore(10, -1) });
  kept = await createEvent(undefined, null, { event_date: yearsBefore(10, 0) });
  const { error } = await admin
    .from("participants")
    .insert(participantRow(expired.id, await sampleSignature()));
  if (error) throw error;
});
afterAll(async () => {
  await deleteEvent(expired.id);
  await deleteEvent(kept.id);
});

describe("delete_expired_events()", () => {
  it("cannot be called by visitors or organisers", async () => {
    const organiser = await clientAs((await organiserSession()).access_token);
    for (const client of [anonClient(), organiser]) {
      const { error } = await client.rpc("delete_expired_events");
      expect(error?.code).toBe("42501");
    }
  });

  it("deletes events past retention with their sign-ins, and keeps the rest", async () => {
    const { error } = await admin.rpc("delete_expired_events");
    expect(error).toBeNull();

    const { data: events } = await admin.from("events").select("id").in("id", [expired.id, kept.id]);
    expect(events).toEqual([{ id: kept.id }]);
    const { data: participants } = await admin
      .from("participants")
      .select("id")
      .eq("event_id", expired.id);
    expect(participants).toEqual([]);
  });
});
