import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getWorkspaceUser } from "@/lib/supabase/session";
import { generateCombinedAttendancePdf } from "@/lib/pdf/generate";
import { MAX_EXPORT_EVENTS, parseEventIds } from "@/lib/export/eventIds";
import type { Event, Participant } from "@/types";

// One PDF with the attendance lists of several events: ?ids=<uuid>,<uuid>,…
export async function GET(req: NextRequest) {
  // Defence in depth – the proxy already blocks unauthenticated requests.
  if (!(await getWorkspaceUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ids = parseEventIds(req.nextUrl.searchParams.get("ids"));
  if (!ids) {
    return NextResponse.json(
      { error: `ids must be 1 to ${MAX_EXPORT_EVENTS} comma-separated event ids` },
      { status: 400 }
    );
  }

  const { data: events, error: eventsError } = await supabaseAdmin
    .from("events")
    .select("*")
    .in("id", ids)
    .order("event_date", { ascending: true });

  if (eventsError) {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
  if (!events || events.length !== ids.length) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: participants, error: participantsError } = await supabaseAdmin
    .from("participants")
    .select("*")
    .in("event_id", ids)
    .order("created_at", { ascending: true });

  if (participantsError) {
    return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 });
  }

  try {
    const all = (participants ?? []) as Participant[];
    const pdfBytes = await generateCombinedAttendancePdf(
      (events as Event[]).map((event) => ({
        event,
        participants: all.filter((p) => p.event_id === event.id),
      }))
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="attendance_${events.length}_events.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
