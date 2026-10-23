"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EventForm, { type EventFormData } from "@/components/EventForm";
import EventList from "@/components/EventList";
import { supabase } from "@/lib/supabase/client";
import { fromDateTimeLocal } from "@/lib/datetime";
import type { Event } from "@/types";

export default function EventsDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        // Always by event date, newest first.
        .order("event_date", { ascending: false });
      if (!error && data) setEvents(data as Event[]);
      setLoading(false);
    }
    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email?.toLowerCase() ?? null);
    }
    fetchEvents();
    fetchUser();
  }, []);

  async function handleCreate(data: EventFormData) {
    setSubmitting(true);
    setError(null);
    // The QR code token is the only key to the public form: 122 random bits.
    const publicToken = crypto.randomUUID().replace(/-/g, "");
    const { data: inserted, error: err } = await supabase
      .from("events")
      .insert({
        title: data.title,
        event_date: fromDateTimeLocal(data.event_date),
        risk_notice: data.risk_notice.trim() || null,
        public_token: publicToken,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
      setSubmitting(false);
    } else if (inserted) {
      // Straight to the new event's QR code. Keep the button disabled meanwhile.
      router.push(`/dashboard/events/${(inserted as Event).id}`);
    }
  }

  // "Your events" are the ones you created; "All events" lists everyone
  // else's (and events without a creator), so nothing appears twice.
  const isMine = (e: Event) => !!userEmail && e.created_by?.toLowerCase() === userEmail;
  const myEvents = events.filter(isMine);
  const otherEvents = events.filter((e) => !isMine(e));

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mr-auto">Events</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-esn text-white text-sm px-4 py-2 rounded-lg shadow-sm hover:bg-esn-dark transition-colors"
        >
          {showForm ? "Cancel" : "+ New Event"}
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-6 px-1">
        For regular events. Funded events (trips, team building) keep the paper attendance list.
      </p>

      {error && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-6">{error}</p>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Event</h2>
          <EventForm onSubmit={handleCreate} loading={submitting} />
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="your-events" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 id="your-events" className="text-lg font-semibold mb-4">Your events</h2>
            <EventList events={myEvents} emptyText="You haven't created any events yet." />
          </section>
          <section aria-labelledby="all-events" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 id="all-events" className="text-lg font-semibold mb-4">All events</h2>
            <EventList events={otherEvents} emptyText="No other events." />
          </section>
        </div>
      )}
    </main>
  );
}
