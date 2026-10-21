import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getWorkspaceUser } from "@/lib/supabase/session";
import { countryName, parseLang } from "@/lib/countries";
import { escapeCSV } from "@/lib/csv";
import type { Event, Participant } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Language for country names: ?lang=de (default) or ?lang=en
  const lang = parseLang(req.nextUrl.searchParams.get("lang"));

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

  const { data: participants, error: participantsError } = await supabaseAdmin
    .from("participants")
    // Signatures stay out of the CSV – it is meant for spreadsheets.
    .select("first_name, last_name, nationality, university, exchange_program, esn_card, created_at, entry_method, recorded_by")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  if (participantsError) {
    return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 });
  }

  const rows: string[] = [
    "Surname,First Name,Nationality,University,Exchange Programme,ESNcard,Registered At,Entry Method,Recorded By",
    ...((participants ?? []) as Omit<Participant, "id" | "event_id" | "signature">[]).map((p) =>
      [
        escapeCSV(p.last_name),
        escapeCSV(p.first_name),
        escapeCSV(countryName(p.nationality, lang)),
        escapeCSV(p.university),
        escapeCSV(p.exchange_program),
        p.esn_card === null ? "" : p.esn_card ? "Yes" : "No",
        escapeCSV(p.created_at),
        escapeCSV(p.entry_method),
        escapeCSV(p.recorded_by),
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
