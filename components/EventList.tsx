"use client";

import Link from "next/link";
import type { Event } from "@/types";

interface Props {
  events: Event[];
  /** Shown when the list is empty. */
  emptyText?: string;
  /** Ids ticked for the combined PDF export. */
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}

export default function EventList({
  events,
  emptyText = "No events yet. Create your first event above.",
  selected,
  onToggle,
}: Props) {
  if (events.length === 0) {
    return <p className="text-gray-500 text-sm py-4 text-center">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-gray-200">
      {events.map((event) => (
        <li key={event.id} className="py-3 flex items-center gap-3 hover:bg-gray-50 px-2 rounded">
          {onToggle && (
            <input
              type="checkbox"
              checked={selected?.has(event.id) ?? false}
              onChange={() => onToggle(event.id)}
              aria-label={`Select ${event.title}`}
              className="h-4 w-4 shrink-0 accent-esn"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate">{event.title}</p>
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
            className="shrink-0 text-esn text-sm font-medium hover:underline"
          >
            View →
          </Link>
        </li>
      ))}
    </ul>
  );
}
