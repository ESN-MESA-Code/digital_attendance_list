import { supabase } from "@/lib/supabase/client";
import type { Event } from "@/types";

/**
 * Whether `email` may sign `event` off: its creator, or anyone for events
 * without one. The database enforces the same rule.
 */
export function canSignOff(event: Event, email: string | null): boolean {
  if (event.signed_off_at || !email) return false;
  return !event.created_by || event.created_by.toLowerCase() === email.toLowerCase();
}

/**
 * Signs the list off with the number of people the organiser counted. Closes
 * sign-ins (from then on only executives see the names); the database
 * records who and when.
 */
export async function signOff(event: Event, headcount: number, email: string): Promise<Event> {
  const { data, error } = await supabase
    .from("events")
    .update({ headcount, signed_off_at: new Date().toISOString(), signed_off_by: email })
    .eq("id", event.id)
    .select()
    .single();
  if (error) throw error;
  return data as Event;
}

export function formatSignedOff(event: Event): string {
  if (!event.signed_off_at) return "Not signed off yet";
  const date = new Date(event.signed_off_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `Signed off on ${date}${event.signed_off_by ? ` by ${event.signed_off_by}` : ""}`;
}
