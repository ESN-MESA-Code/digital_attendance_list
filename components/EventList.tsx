"use client";

import Link from "next/link";
import type { Event } from "@/types";

interface Props {
  events: Event[];
}

export default function EventList({ events }: Props) {
  if (events.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4 text-center">
        No events yet. Create your first event above.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-200">
      {events.map((event) => (
        <li key={event.id} className="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded">
          <div>
            <p className="font-medium text-gray-900">{event.title}</p>
            <p className="text-xs text-gray-500">
              {new Date(event.event_date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <Link
            href={`/dashboard/events/${event.id}`}
            className="text-blue-600 text-sm font-medium hover:underline"
          >
            View →
          </Link>
        </li>
      ))}
    </ul>
  );
}
