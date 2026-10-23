"use client";

import Link from "next/link";
import { formatSignedOff } from "@/lib/events/signoff";
import { listState } from "@/lib/events/window";
import type { Event } from "@/types";

interface Props {
  events: Event[];
  /** Shown when the list is empty. */
  emptyText?: string;
}

const STATUS = {
  upcoming: { label: "Upcoming", className: "border border-gray-300 text-gray-600" },
  open: { label: "Open", className: "bg-amber-50 text-amber-800 border border-amber-200" },
  // Closed 24 hours after the event; finance waits for the organiser's count.
  closed: { label: "Awaiting sign-off", className: "bg-red-50 text-red-700 border border-red-200" },
  signed: { label: "✓ Signed off", className: "bg-esn/10 text-esn" },
} as const;

export default function EventList({ events, emptyText = "No events yet. Create your first event above." }: Props) {
  if (events.length === 0) {
    return <p className="text-gray-500 text-sm py-4 text-center">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-gray-200">
      {events.map((event) => {
        const status = STATUS[event.signed_off_at ? "signed" : listState(event)];
        return (
          <li key={event.id} className="py-3 flex items-center gap-3 px-2 rounded hover:bg-gray-50">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 line-clamp-2 break-words">{event.title}</p>
              <p className="text-xs text-gray-500">
                {new Date(event.event_date).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span
                  title={formatSignedOff(event)}
                  aria-label={`${status.label.replace("✓ ", "")}: ${event.title}`}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                >
                  {status.label}
                </span>
                {event.signed_off_at && event.stats && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs text-gray-600 bg-gray-100">
                    {event.stats.signins} signed in · {event.headcount} counted
                  </span>
                )}
              </div>
            </div>
            <Link
              href={`/dashboard/events/${event.id}`}
              className="shrink-0 text-esn text-sm font-medium hover:underline"
            >
              View →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
