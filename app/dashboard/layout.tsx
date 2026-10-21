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
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard/events" className="shrink-0">
            <Image
              src="/esn-mesa-logo-white.png"
              alt="ESN MESA München"
              width={600}
              height={334}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <div className="w-px h-6 bg-white/30 mx-1" />
          <Link
            href="/dashboard/events"
            className="text-sm font-medium opacity-90 hover:opacity-100 hover:underline"
          >
            Events
          </Link>
          {user && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden sm:inline text-xs opacity-80">{user.email}</span>
              <form action="/auth/signout" method="post">
                <button className="text-sm font-medium opacity-90 hover:opacity-100 hover:underline">
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {children}
    </>
  );
}
