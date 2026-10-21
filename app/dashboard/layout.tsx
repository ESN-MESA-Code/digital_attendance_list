import Link from "next/link";
import Image from "next/image";
import { getWorkspaceUser } from "@/lib/supabase/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getWorkspaceUser();

  return (
    <>
      {/* ESN-branded top navbar */}
      <header className="bg-esn text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 h-16 sm:h-20 flex items-center gap-4">
          {/* The logo is the way back to the events page, the only main page. */}
          <Link href="/dashboard/events" className="shrink-0" aria-label="ESN MESA München – back to events">
            <Image
              src="/esn-mesa-logo-white.png"
              alt="ESN MESA München"
              width={600}
              height={334}
              priority
              className="h-12 sm:h-16 w-auto"
            />
          </Link>
          {user && <SignedInAs email={user.email ?? ""} meta={user.user_metadata} />}
        </div>
      </header>

      {children}
    </>
  );
}

/** Who is signed in (Google picture or initials, name, email) and sign-out. */
function SignedInAs({ email, meta }: { email: string; meta: Record<string, unknown> }) {
  const name = String(meta.full_name ?? meta.name ?? "") || email.split("@")[0];
  const picture = String(meta.avatar_url ?? meta.picture ?? "");
  const initials = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  return (
    <div className="ml-auto flex items-center gap-3">
      <div className="flex items-center gap-2.5 min-w-0" title={`Signed in as ${email}`}>
        {picture.startsWith("https://") ? (
          // The Google profile picture; no Referer to Google.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full ring-2 ring-white/40 object-cover shrink-0"
          />
        ) : (
          <span
            aria-hidden="true"
            className="h-9 w-9 rounded-full bg-white/15 ring-2 ring-white/40 flex items-center justify-center text-sm font-semibold shrink-0"
          >
            {initials}
          </span>
        )}
        <div className="hidden sm:block leading-tight min-w-0">
          <p className="text-sm font-medium truncate max-w-[14rem]">{name}</p>
          <p className="text-xs text-white/70 truncate max-w-[14rem]">{email}</p>
        </div>
      </div>
      <form action="/auth/signout" method="post">
        <button
          aria-label="Sign out"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 sm:px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
            <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
          </svg>
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </form>
    </div>
  );
}
