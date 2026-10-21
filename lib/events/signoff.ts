import { supabase } from "@/lib/supabase/client";
import type { Event } from "@/types";

/**
 * Whether `email` may sign `event` off: its creator, or anyone for events
 * from before creators were recorded. The database enforces the same rule.
 */
export function canSignOff(event: Event, email: string | null): boolean {
  if (event.signed_off_at || !email) return false;
  return !event.created_by || event.created_by.toLowerCase() === email.toLowerCase();
}

/** Signs the list off with the organiser's signature; closes sign-ins. */
export async function signOff(event: Event, signature: string, email: string): Promise<Event> {
  const { data, error } = await supabase
    .from("events")
    // The database records the time and the signer itself.
    .update({ organiser_signature: signature, signed_off_at: new Date().toISOString(), signed_off_by: email })
    .eq("id", event.id)
    .select()
    .single();
  if (error) throw error;
  return data as Event;
}

export function formatSignedOff(event: Event): string {
  if (!event.signed_off_at) return "Open for sign-ins";
  const date = new Date(event.signed_off_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `Signed off on ${date}${event.signed_off_by ? ` by ${event.signed_off_by}` : ""}`;
}
