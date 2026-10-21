import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getWorkspaceUser } from "@/lib/supabase/session";
import { generateAttendancePdf } from "@/lib/pdf/generate";
import type { Event, Participant } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Defence in depth – the proxy already blocks unauthenticated requests.
  if (!(await getWorkspaceUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // The PDF is the signed list: only after the organiser signed it off.
  if (!(event as Event).signed_off_at) {
    return NextResponse.json({ error: "The event has not been signed off yet" }, { status: 409 });
  }

  const { data: participants, error: participantsError } = await supabaseAdmin
    .from("participants")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  if (participantsError) {
    return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 });
  }

  try {
    const pdfBytes = await generateAttendancePdf(
      event as Event,
      (participants ?? []) as Participant[]
    );

    const safeTitle = (event as Event).title.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}_attendance.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
