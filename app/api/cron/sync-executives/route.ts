import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executivesConfigured, syncExecutives } from "@/lib/executives";

// Daily sync of public.executives with the executives' Google Workspace group
// (vercel.json schedules it). Vercel Cron sends "Authorization: Bearer
// <CRON_SECRET>"; nobody else may trigger it.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  if (!secret || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!executivesConfigured()) {
    return NextResponse.json({ error: "Executives sync is not configured" }, { status: 503 });
  }
  try {
    return NextResponse.json({ executives: await syncExecutives() });
  } catch (err) {
    console.error("Executives sync failed:", err);
    return NextResponse.json({ error: "Executives sync failed" }, { status: 502 });
  }
}
