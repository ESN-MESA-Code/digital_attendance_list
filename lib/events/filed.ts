import { supabase } from "@/lib/supabase/client";
import type { Event } from "@/types";

/**
 * Marks events' printed lists as filed in the office (or not). Returns the
 * updated rows; RLS lets only Workspace organisers do this.
 */
export async function setFiled(ids: string[], filed: boolean, email: string | null) {
  const { data, error } = await supabase
    .from("events")
    .update(
      filed
        ? { filed_at: new Date().toISOString(), filed_by: email ?? "unknown" }
        : { filed_at: null, filed_by: null }
    )
    .in("id", ids)
    .select();
  if (error) throw error;
  return (data ?? []) as Event[];
}

export function formatFiled(event: Event): string {
  if (!event.filed_at) return "Not filed yet";
  const date = new Date(event.filed_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `Filed in the office on ${date}${event.filed_by ? ` by ${event.filed_by}` : ""}`;
}
