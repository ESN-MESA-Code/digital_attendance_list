import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isWorkspaceUser } from "@/lib/auth";

// Refreshes the Supabase session on every request and keeps organiser-only
// routes (including the kiosk form on organiser devices) behind the Google
// Workspace login and the organisers' confidentiality rules (/confidentiality).
// The public attendance form (/event/[token]) stays open.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/kiosk") ||
    pathname.startsWith("/api/export") ||
    pathname.startsWith("/confidentiality");

  if (!isProtected) return response;

  if (!isWorkspaceUser(user)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return redirectTo(request, "/login", pathname + search);
  }

  // Organisers see no list before they accepted the confidentiality rules
  // (the database refuses them too, see public.is_workspace_member()).
  if (!pathname.startsWith("/confidentiality")) {
    const { data: accepted } = await supabase.rpc("is_workspace_member");
    if (accepted !== true) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Confidentiality rules not accepted" }, { status: 403 });
      }
      return redirectTo(request, "/confidentiality", pathname + search);
    }
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string, next: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/kiosk/:path*",
    "/api/export/:path*",
    "/confidentiality/:path*",
    "/login",
    "/auth/:path*",
  ],
};
