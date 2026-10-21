"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useParticipants } from "@/hooks/useParticipants";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import AttendanceTable from "@/components/AttendanceTable";
import ExportButtons from "@/components/ExportButtons";
import EventForm, { type EventFormData } from "@/components/EventForm";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/datetime";
import { formatFiled, setFiled } from "@/lib/events/filed";
import { canSignOff, formatSignedOff, signOff } from "@/lib/events/signoff";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import type { Event } from "@/types";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const { participants, loading: loadingParticipants } = useParticipants(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // Finishing the event: the organiser's signature pad is open.
  const [signing, setSigning] = useState(false);
  const sigPadRef = useRef<SignaturePadHandle>(null);

  async function submitSignOff() {
    if (!event || !userEmail) return;
    if (sigPadRef.current?.isEmpty()) {
      setActionError("Please sign first.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const signature = await sigPadRef.current!.toPng();
      setEvent(await signOff(event, signature, userEmail));
      setSigning(false);
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
      setActionError(message || "Could not sign the event off.");
    } finally {
      setSaving(false);
    }
  }

  // Fixes typos and the like. Only these fields change: the id and the QR
  // code's token stay, so printed QR codes and sign-ins keep working. The
  // responsible member stays the creator.
  async function saveEdit(data: EventFormData) {
    if (!event) return;
    setSaving(true);
    setActionError(null);
    const { data: updated, error } = await supabase
      .from("events")
      .update({
        title: data.title,
        event_date: fromDateTimeLocal(data.event_date),
      })
      .eq("id", event.id)
      .select()
      .single();
    setSaving(false);
    if (error || !updated) {
      setActionError(error?.message ?? "Could not save the changes.");
      return;
    }
    setEvent(updated as Event);
    setEditing(false);
  }

  async function toggleFiled() {
    if (!event) return;
    setActionError(null);
    try {
      const [updated] = await setFiled([event.id], !event.filed_at, userEmail);
      if (updated) setEvent(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the event.");
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
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
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

      {/* Event info, filed status and editing */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {editing ? (
          <>
            <h2 className="text-lg font-semibold mb-4">Edit event</h2>
            {actionError && <p className="text-red-500 text-sm mb-3">{actionError}</p>}
            <EventForm
              initialValues={{
                title: event.title,
                event_date: toDateTimeLocal(event.event_date),
              }}
              onSubmit={saveEdit}
              onCancel={() => {
                setEditing(false);
                setActionError(null);
              }}
              loading={saving}
            />
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <h1 className="text-2xl font-bold text-gray-900 mr-auto break-words min-w-0">{event.title}</h1>
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-esn hover:text-esn transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                  <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                </svg>
                Edit
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {new Date(event.event_date).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {event.responsible_member && (
              <p className="text-xs text-gray-500 mt-1">Responsible: {event.responsible_member}</p>
            )}

            {/* Status: signed off by the organiser, then filed in the office */}
            <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  title={formatSignedOff(event)}
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    event.signed_off_at ? "bg-esn/10 text-esn" : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {event.signed_off_at ? "✓ Signed off" : "Open for sign-ins"}
                </span>
                {event.signed_off_at ? (
                  <span className="text-xs text-gray-500">{formatSignedOff(event).replace(/^Signed off /, "")}</span>
                ) : canSignOff(event, userEmail) ? (
                  !signing && (
                    <button
                      onClick={() => {
                        setSigning(true);
                        setActionError(null);
                      }}
                      className="bg-esn text-white text-sm px-3.5 py-1.5 rounded-lg shadow-sm hover:bg-esn-dark transition-colors"
                    >
                      Finish &amp; sign
                    </button>
                  )
                ) : (
                  <span className="text-xs text-gray-500">
                    Only {event.created_by ?? "the creator"} can sign this event off.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    event.filed_at ? "bg-green-100 text-green-800" : "border border-dashed border-gray-300 text-gray-500"
                  }`}
                  title={formatFiled(event)}
                >
                  {event.filed_at ? "✓ Filed in office" : "Not filed yet"}
                </span>
                {event.filed_at && (
                  <span className="text-xs text-gray-500">{formatFiled(event).replace(/^Filed in the office /, "")}</span>
                )}
                {event.filed_at ? (
                  <button
                    onClick={toggleFiled}
                    className="border border-gray-300 bg-white text-gray-600 text-sm px-3 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Undo
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleFiled}
                      disabled={!event.signed_off_at}
                      title={event.signed_off_at ? undefined : "Sign the event off before filing it"}
                      className="bg-green-600 text-white text-sm px-3.5 py-1.5 rounded-lg shadow-sm enabled:hover:bg-green-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                      ✓ Mark as filed
                    </button>
                    {!event.signed_off_at && (
                      <span className="text-xs text-gray-400">Possible after the sign-off.</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {signing && (
              <div className="mt-4 rounded-lg border border-esn/30 bg-esn/5 p-4 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Finish the event and sign the attendance list</h2>
                  <p className="text-xs text-gray-600 mt-1">
                    After signing, nobody can sign in to this event any more. Your signature appears
                    on the PDF as the responsible MESA member&apos;s signature.
                  </p>
                </div>
                <SignaturePad ref={sigPadRef} />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSigning(false);
                      setActionError(null);
                    }}
                    disabled={saving}
                    className="border border-gray-300 bg-white text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitSignOff}
                    disabled={saving}
                    className="flex-1 bg-esn text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-esn-dark disabled:opacity-50"
                  >
                    {saving ? "Signing…" : "Sign off & close sign-ins"}
                  </button>
                </div>
              </div>
            )}
            {actionError && <p className="text-xs text-red-500 mt-2">{actionError}</p>}
          </>
        )}
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center">
        <h2 className="text-lg font-semibold mb-4 self-start">Attendance QR Code</h2>
        {event.signed_off_at ? (
          <p className="text-sm text-gray-600 py-6 text-center">
            🔒 Sign-ins are closed – the attendance list was signed off.
          </p>
        ) : (
          <>
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
          </>
        )}
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
          <ExportButtons
            eventId={event.id}
            pdfDisabledReason={event.signed_off_at ? undefined : "Sign the event off before exporting the PDF"}
          />
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
