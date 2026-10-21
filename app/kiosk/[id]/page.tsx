import { notFound, redirect } from "next/navigation";
import { createSessionClient, getWorkspaceUser } from "@/lib/supabase/session";
import KioskView from "@/components/KioskView";
import type { Event } from "@/types";

// Attendance form on an organiser's device, for participants without a phone
// or internet. Lives outside /dashboard so the organiser navigation is hidden.
export default async function KioskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Defence in depth – the proxy already redirects signed-out visitors.
  const user = await getWorkspaceUser();
  if (!user?.email) redirect(`/login?next=${encodeURIComponent(`/kiosk/${id}`)}`);

  const supabase = await createSessionClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).single();
  if (!event) notFound();

  return <KioskView event={event as Event} recordedBy={user.email} />;
}
