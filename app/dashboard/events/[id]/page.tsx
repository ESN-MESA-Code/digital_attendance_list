"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useParticipants } from "@/hooks/useParticipants";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import AttendanceTable from "@/components/AttendanceTable";
import EventSummary from "@/components/EventSummary";
import EventForm, { type EventFormData } from "@/components/EventForm";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/datetime";
import { canSignOff, formatSignedOff, signOff } from "@/lib/events/signoff";
import { formatDateTime, listState, signinsOpenAt } from "@/lib/events/window";
import type { Event, EventStats } from "@/types";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const { participants, loading: loadingParticipants } = useParticipants(id);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [isExecutive, setIsExecutive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // Finishing the event: the headcount field is open.
  const [signingOff, setSigningOff] = useState(false);
  const [headcount, setHeadcount] = useState("");
  const [copied, setCopied] = useState(false);
  // Re-render every minute, so the page follows the sign-in window.
  const [, setTick] = useState(0);

  const fetchStats = useCallback(async () => {
    const { data } = await supabase.rpc("event_summary", { event: id });
    setStats((data as EventStats | null) ?? null);
  }, [id]);

  useEffect(() => {
    async function fetchEvent() {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (!error && data) setEvent(data as Event);
      setLoading(false);
    }
    fetchEvent();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    supabase.rpc("is_executive").then(({ data }) => setIsExecutive(data === true));
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [id]);

  // The counts follow the live list (and the sign-off).
  useEffect(() => {
    fetchStats();
  }, [fetchStats, participants.length, event?.signed_off_at]);

  async function submitSignOff() {
    if (!event || !userEmail) return;
    const counted = Number(headcount);
    if (headcount.trim() === "" || !Number.isInteger(counted) || counted < 0 || counted > 10000) {
      setActionError("Please enter how many people you counted.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      setEvent(await signOff(event, counted, userEmail));
      setSigningOff(false);
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
      setActionError(message || "Could not sign the event off.");
    } finally {
      setSaving(false);
    }
  }

  // Fixes typos and the like. The id and the QR code's token stay, so printed
  // QR codes and sign-ins keep working. Once people signed in, only the title
  // can change (the date and risk notice are what they saw).
  async function saveEdit(data: EventFormData) {
    if (!event) return;
    setSaving(true);
    setActionError(null);
    const locked = (stats?.signins ?? 0) > 0;
    const { data: updated, error } = await supabase
      .from("events")
      .update({
        title: data.title,
        ...(!locked && {
          event_date: fromDateTimeLocal(data.event_date),
          risk_notice: data.risk_notice.trim() || null,
        }),
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setActionError("Could not copy – copy the address from the browser instead.");
    }
  }

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

  const state = listState(event);
  // Organisers see names while the list is open, executives always.
  const canSeeNames = state !== "closed" || isExecutive;
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

      {/* Event info, sign-off and editing */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {editing ? (
          <>
            <h2 className="text-lg font-semibold mb-4">Edit event</h2>
            {actionError && <p className="text-red-500 text-sm mb-3">{actionError}</p>}
            <EventForm
              initialValues={{
                title: event.title,
                event_date: toDateTimeLocal(event.event_date),
                risk_notice: event.risk_notice ?? "",
              }}
              lockSignInFields={(stats?.signins ?? 0) > 0}
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
            <p className="text-xs text-gray-400 mt-2">{formatDateTime(event.event_date)}</p>
            {event.responsible_member && (
              <p className="text-xs text-gray-500 mt-1">Responsible: {event.responsible_member}</p>
            )}
            {event.risk_notice && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-900">Risk notice</p>
                <p className="text-sm text-amber-900 whitespace-pre-line">{event.risk_notice}</p>
              </div>
            )}

            {/* Status: open, waiting for the sign-off, or signed off */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                title={formatSignedOff(event)}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  event.signed_off_at ? "bg-esn/10 text-esn" : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {event.signed_off_at
                  ? "✓ Signed off"
                  : state === "open"
                    ? "Open for sign-ins"
                    : state === "upcoming"
                      ? "Not open yet"
                      : "Closed – awaiting sign-off"}
              </span>
              {event.signed_off_at ? (
                <span className="text-xs text-gray-500">{formatSignedOff(event).replace(/^Signed off /, "")}</span>
              ) : canSignOff(event, userEmail) ? (
                !signingOff && (
                  <button
                    onClick={() => {
                      setSigningOff(true);
                      setActionError(null);
                    }}
                    className="bg-esn text-white text-sm px-3.5 py-1.5 rounded-lg shadow-sm hover:bg-esn-dark transition-colors"
                  >
                    Finish &amp; sign off
                  </button>
                )
              ) : (
                <span className="text-xs text-gray-500">
                  Only {event.created_by ?? "the creator"} can sign this event off.
                </span>
              )}
            </div>

            {signingOff && (
              <div className="mt-4 rounded-lg border border-esn/30 bg-esn/5 p-4 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Finish the event and sign the list off</h2>
                  <p className="text-xs text-gray-600 mt-1">
                    After the sign-off nobody can sign in any more. The optional details are counted
                    and removed from the sign-ins, and only executives see the names from then on.
                  </p>
                </div>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    How many people did you count at the event?
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={10000}
                    value={headcount}
                    onChange={(e) => setHeadcount(e.target.value)}
                    className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSigningOff(false);
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
                    {saving ? "Signing off…" : "Sign off & close sign-ins"}
                  </button>
                </div>
              </div>
            )}
            {actionError && <p className="text-xs text-red-500 mt-2">{actionError}</p>}
          </>
        )}
      </div>

      {/* Summary: what finance checks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Summary</h2>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-esn hover:text-esn transition-colors"
          >
            {copied ? "✓ Link copied" : "Copy link for finance"}
          </button>
        </div>
        <EventSummary event={event} stats={stats} />
        <p className="text-xs text-gray-400">
          Finance opens this page with their @esnmesa.org account and sees these counts, not the names.
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center">
        <h2 className="text-lg font-semibold mb-4 self-start">Attendance QR Code</h2>
        {state === "closed" ? (
          <p className="text-sm text-gray-600 py-6 text-center">
            🔒 Sign-ins are closed –{" "}
            {event.signed_off_at ? "the attendance list was signed off." : "the event ended more than 24 hours ago."}
          </p>
        ) : (
          <>
            {state === "upcoming" && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4 text-center">
                Sign-ins open at {formatDateTime(signinsOpenAt(event.event_date))}.
              </p>
            )}
            <QRCodeDisplay url={attendanceUrl} size={220} />
            {state === "open" && (
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
            )}
          </>
        )}
      </div>

      {/* Participants */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1 pt-1 sm:p-0">
          <h2 className="text-lg font-semibold">
            Participants{" "}
            <span className="text-gray-400 font-normal text-base">({stats?.signins ?? participants.length})</span>
          </h2>
          {isExecutive && state === "closed" && (
            <span className="text-xs text-gray-500">Visible to you as an executive</span>
          )}
        </div>
        {!canSeeNames ? (
          <p className="text-gray-500 text-sm py-4 text-center">
            The list is closed: only executives see the names now.
          </p>
        ) : loadingParticipants ? (
          <p className="text-gray-500 text-sm">Loading participants…</p>
        ) : (
          <AttendanceTable participants={participants} />
        )}
      </div>
    </main>
  );
}
