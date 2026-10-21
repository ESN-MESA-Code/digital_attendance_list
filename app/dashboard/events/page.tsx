"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EventForm from "@/components/EventForm";
import EventList from "@/components/EventList";
import { supabase } from "@/lib/supabase/client";
import { DEFAULT_EXPORT_LANG, EXPORT_LANGUAGES, type Lang } from "@/lib/countries";
import { MAX_EXPORT_EVENTS } from "@/lib/export/eventIds";
import type { Event } from "@/types";

export default function EventsDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // Events ticked for the combined PDF, and the language of its country names.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportLang, setExportLang] = useState<Lang>(DEFAULT_EXPORT_LANG);

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setEvents(data as Event[]);
      setLoading(false);
    }
    async function fetchUserName() {
      const { data } = await supabase.auth.getUser();
      const meta = data.user?.user_metadata;
      setUserName(meta?.full_name ?? meta?.name ?? "");
      setUserEmail(data.user?.email?.toLowerCase() ?? null);
    }
    fetchEvents();
    fetchUserName();
  }, []);

  async function handleCreate(data: {
    title: string;
    description?: string;
    event_date: string;
    responsible_member?: string;
    lei_responsible?: string;
  }) {
    setSubmitting(true);
    setError(null);
    // The QR code token is the only key to the public form: 122 random bits.
    const publicToken = crypto.randomUUID().replace(/-/g, "");
    const { data: inserted, error: err } = await supabase
      .from("events")
      .insert({
        title: data.title,
        description: data.description ?? "",
        event_date: data.event_date,
        responsible_member: data.responsible_member ?? null,
        lei_responsible: data.lei_responsible ?? null,
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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "Your events" are the ones you created; "All events" lists everyone
  // else's (and older events without a creator), so nothing appears twice.
  const isMine = (e: Event) => !!userEmail && e.created_by?.toLowerCase() === userEmail;
  const myEvents = events.filter(isMine);
  const otherEvents = events.filter((e) => !isMine(e));
  const tooMany = selected.size > MAX_EXPORT_EVENTS;

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
          <EventForm onSubmit={handleCreate} loading={submitting} defaultResponsible={userName} />
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 bg-white rounded-xl shadow-md border border-gray-200 px-4 py-3 mb-6 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {selected.size} selected
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 hover:underline"
          >
            Clear
          </button>
          <label className="ml-auto flex items-center gap-2 text-sm text-gray-600">
            Countries in
            <select
              value={exportLang}
              onChange={(e) => setExportLang(e.target.value as Lang)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-esn-accent"
            >
              {Object.entries(EXPORT_LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {tooMany ? (
            <span className="text-sm text-red-500">At most {MAX_EXPORT_EVENTS} events</span>
          ) : (
            <a
              href={`/api/export/events/pdf?ids=${[...selected].join(",")}&lang=${exportLang}`}
              download
              className="inline-flex items-center gap-1 bg-red-600 text-white text-sm px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Export PDF
            </a>
          )}
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
            <EventList
              events={myEvents}
              emptyText="You haven't created any events yet."
              selected={selected}
              onToggle={toggle}
            />
          </section>
          <section aria-labelledby="all-events" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 id="all-events" className="text-lg font-semibold mb-1">All events</h2>
            <p className="text-xs text-gray-500 mb-3">Created by other organisers, or before creators were recorded.</p>
            <EventList
              events={otherEvents}
              emptyText="No other events."
              selected={selected}
              onToggle={toggle}
            />
          </section>
        </div>
      )}
    </main>
  );
}
