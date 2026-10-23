import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/session";
import { isWorkspaceUser, safeNext } from "@/lib/auth";
import { refreshExecutive } from "@/lib/executives";

// Google → Supabase redirects here with a one-time code after sign-in.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  if (!isWorkspaceUser(data.user)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // Joined or left the executives' group since the last daily sync? A failed
  // check leaves the status as it was and does not stop the login.
  try {
    await refreshExecutive(data.user.email!);
  } catch (err) {
    console.error("Executive check at login failed:", err);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
