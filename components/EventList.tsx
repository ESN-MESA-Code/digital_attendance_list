"use client";

import Link from "next/link";
import { formatFiled } from "@/lib/events/filed";
import type { Event } from "@/types";

interface Props {
  events: Event[];
  /** Shown when the list is empty. */
  emptyText?: string;
  /** Set while picking events for the combined PDF: shows checkboxes. */
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  /** Flips an event's "filed in the office" state. */
  onToggleFiled?: (event: Event) => void;
}

export default function EventList({
  events,
  emptyText = "No events yet. Create your first event above.",
  selected,
  onToggle,
  onToggleFiled,
}: Props) {
  if (events.length === 0) {
    return <p className="text-gray-500 text-sm py-4 text-center">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-gray-200">
      {events.map((event) => {
        const isSelected = selected?.has(event.id) ?? false;
        return (
          <li
            key={event.id}
            className={`py-3 flex items-center gap-3 px-2 rounded ${
              isSelected ? "bg-esn/5" : "hover:bg-gray-50"
            }`}
          >
            {selected && onToggle && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(event.id)}
                aria-label={`Select ${event.title}`}
                className="h-4 w-4 shrink-0 accent-esn"
              />
            )}
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
            </div>
            {onToggleFiled && (
              <button
                type="button"
                onClick={() => onToggleFiled(event)}
                title={`${formatFiled(event)} – click to change`}
                aria-label={`${event.filed_at ? "Filed" : "Not filed"}: ${event.title}`}
                aria-pressed={!!event.filed_at}
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  event.filed_at
                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                    : "border border-dashed border-gray-300 text-gray-500 hover:border-esn hover:text-esn"
                }`}
              >
                {event.filed_at ? "✓ Filed" : "Not filed"}
              </button>
            )}
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
