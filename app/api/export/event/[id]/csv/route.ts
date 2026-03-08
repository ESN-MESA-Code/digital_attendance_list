import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Event, Participant } from "@/types";

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: participants, error: participantsError } = await supabaseAdmin
    .from("participants")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  if (participantsError) {
    return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 });
  }

  const rows: string[] = [
    "Name,Email,Organization,Signature URL,Registered At",
    ...((participants ?? []) as Participant[]).map((p) =>
      [
        escapeCSV(p.name),
        escapeCSV(p.email),
        escapeCSV(p.organization),
        escapeCSV(p.signature_url),
        escapeCSV(p.created_at),
      ].join(",")
    ),
  ];

  const csv = rows.join("\r\n");
  const safeTitle = (event as Event).title.replace(/[^a-z0-9]/gi, "_").toLowerCase();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle}_attendance.csv"`,
    },
  });
}
