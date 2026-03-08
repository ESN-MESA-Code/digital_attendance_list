"use client";

import { useState, useEffect } from "react";
import EventForm from "@/components/EventForm";
import EventList from "@/components/EventList";
import { supabase } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";
import type { Event } from "@/types";

export default function EventsDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setEvents(data as Event[]);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  async function handleCreate(data: {
    title: string;
    description?: string;
    event_date: string;
  }) {
    setSubmitting(true);
    setError(null);
    const publicToken = uuidv4().replace(/-/g, "").slice(0, 16);
    const { data: inserted, error: err } = await supabase
      .from("events")
      .insert({
        title: data.title,
        description: data.description ?? "",
        event_date: data.event_date,
        public_token: publicToken,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
    } else if (inserted) {
      setEvents((prev) => [inserted as Event, ...prev]);
      setShowForm(false);
    }
    setSubmitting(false);
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-esn text-white text-sm px-4 py-2 rounded-md hover:bg-esn-dark transition-colors"
        >
          {showForm ? "Cancel" : "+ New Event"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Event</h2>
          {error && (
            <p className="text-red-500 text-sm mb-3">{error}</p>
          )}
          <EventForm onSubmit={handleCreate} loading={submitting} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">All Events</h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <EventList events={events} />
        )}
      </div>
    </main>
  );
}
