import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/session";
import { LOCAL_ORGANISER_EMAIL, localLoginEnabled } from "@/lib/localLogin";

// Password of the seeded organiser (supabase/seed.sql); kept out of the
// login page's browser bundle.
const LOCAL_PASSWORD = "local-test-password";

// Signs in as the seeded test organiser – `npm run dev:local` only.
export async function POST(req: NextRequest) {
  if (!localLoginEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email: LOCAL_ORGANISER_EMAIL, password: LOCAL_PASSWORD });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url), 303);
  }

  // Only paths on this site.
  const next = String((await req.formData()).get("next") ?? "");
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard/events";
  return NextResponse.redirect(new URL(target, req.url), 303);
}
