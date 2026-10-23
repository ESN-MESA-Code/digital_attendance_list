// Privacy: events and their sign-ins are deleted at the end of the third
// calendar year after the event, as the privacy notice promises; organisers' IP
// addresses in Supabase Auth are removed after 30 days.
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
import { LEGAL } from "@/lib/legal";

const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
const yearsBefore = (years: number, days: number) =>
  new Date(Date.UTC(startOfYear.getUTCFullYear() - years, 0, 1 + days)).toISOString();

let expired: TestEvent;
let kept: TestEvent;

beforeAll(async () => {
  // The last day of the fourth year back is past retention; the first day of
  // the third year back is kept until the end of this year.
  expired = await createEvent(undefined, null, { event_date: yearsBefore(3, -1) });
  kept = await createEvent(undefined, null, { event_date: yearsBefore(3, 0) });
  const { error } = await admin.from("participants").insert(participantRow(expired.id));
  if (error) throw error;
});
afterAll(async () => {
  await deleteEvent(expired.id);
  await deleteEvent(kept.id);
});

describe("delete_expired_events()", () => {
  it("keeps lists as long as the privacy notice says", () => {
    expect(LEGAL.retention.years).toBe(3);
  });

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

describe("purge_auth_ip_addresses()", () => {
  it("cannot be called by visitors or organisers", async () => {
    const organiser = await clientAs((await organiserSession()).access_token);
    for (const client of [anonClient(), organiser]) {
      const { error } = await client.rpc("purge_auth_ip_addresses");
      expect(error?.code).toBe("42501");
    }
  });

  it("runs for the scheduled job and signs nobody out", async () => {
    const session = await organiserSession();
    const { error } = await admin.rpc("purge_auth_ip_addresses");
    expect(error).toBeNull();
    const organiser = await clientAs(session.access_token);
    const { error: readError } = await organiser.from("events").select("id").limit(1);
    expect(readError).toBeNull();
  });
});
