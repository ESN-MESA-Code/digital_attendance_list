import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* ESN-branded top navbar */}
      <header className="bg-esn text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* ESN star mark – six-pointed, rendered with Unicode asterisk */}
          <span className="text-2xl font-black leading-none text-esn-accent" aria-hidden="true">✦</span>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-extrabold tracking-tight">ESN</span>
            <span className="text-[10px] font-medium opacity-80 -mt-0.5 tracking-wide">
              MESA München
            </span>
          </div>
          <div className="w-px h-6 bg-white/30 mx-1" />
          <Link
            href="/dashboard/events"
            className="text-sm font-medium opacity-90 hover:opacity-100 hover:underline"
          >
            Events
          </Link>
        </div>
      </header>

      {children}
    </>
  );
}
