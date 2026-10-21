"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useParticipants } from "@/hooks/useParticipants";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import AttendanceTable from "@/components/AttendanceTable";
import ExportButtons from "@/components/ExportButtons";
import { formatFiled, setFiled } from "@/lib/events/filed";
import type { Event } from "@/types";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const { participants, loading: loadingParticipants } = useParticipants(id);
  const [filedError, setFiledError] = useState<string | null>(null);

  async function toggleFiled() {
    if (!event) return;
    setFiledError(null);
    try {
      const { data } = await supabase.auth.getUser();
      const [updated] = await setFiled([event.id], !event.filed_at, data.user?.email ?? null);
      if (updated) setEvent(updated);
    } catch (err) {
      setFiledError(err instanceof Error ? err.message : "Could not update the event.");
    }
  }

  useEffect(() => {
    async function fetchEvent() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) setEvent(data as Event);
      setLoading(false);
    }
    fetchEvent();
  }, [id]);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-red-500">Event not found.</p>
        <Link href="/dashboard/events" className="text-esn hover:underline text-sm mt-2 block">
          ← Back to events
        </Link>
      </main>
    );
  }

  const attendanceUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/event/${event.public_token}`
      : `/event/${event.public_token}`;

  return (
    <main className="max-w-4xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/dashboard/events" className="text-esn hover:underline text-sm">
          ← Events
        </Link>
      </div>

      {/* Event Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{event.title}</h1>
        {event.description && (
          <p className="text-gray-600 text-sm mb-3">{event.description}</p>
        )}
        <p className="text-xs text-gray-400">
          {new Date(event.event_date).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Printed list in the office */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold text-gray-900">Printed list</h2>
          <p className={`text-xs ${event.filed_at ? "text-green-700" : "text-gray-500"}`}>{formatFiled(event)}</p>
          {filedError && <p className="text-xs text-red-500 mt-1">{filedError}</p>}
        </div>
        <button
          onClick={toggleFiled}
          className={
            event.filed_at
              ? "text-sm text-gray-500 hover:underline"
              : "bg-green-600 text-white text-sm px-3.5 py-2 rounded-lg shadow-sm hover:bg-green-700 transition-colors"
          }
        >
          {event.filed_at ? "Undo" : "✓ Mark as filed"}
        </button>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center">
        <h2 className="text-lg font-semibold mb-4 self-start">Attendance QR Code</h2>
        <QRCodeDisplay url={attendanceUrl} size={220} />
        <div className="mt-6 pt-4 border-t border-gray-200 w-full text-center">
          <Link
            href={`/kiosk/${event.id}`}
            className="inline-block bg-esn text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-esn-dark transition-colors"
          >
            Sign in on this device
          </Link>
          <p className="text-xs text-gray-400 mt-2">
            For participants without a phone or internet: opens the form on your device and
            clears it after each person.
          </p>
        </div>
      </div>

      {/* Participants */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1 pt-1 sm:p-0">
          <h2 className="text-lg font-semibold">
            Participants{" "}
            <span className="text-gray-400 font-normal text-base">
              ({participants.length})
            </span>
          </h2>
          <ExportButtons eventId={event.id} />
        </div>
        {loadingParticipants ? (
          <p className="text-gray-500 text-sm">Loading participants…</p>
        ) : (
          <AttendanceTable participants={participants} />
        )}
      </div>
    </main>
  );
}
