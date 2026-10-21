"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EventForm from "@/components/EventForm";
import EventList from "@/components/EventList";
import { supabase } from "@/lib/supabase/client";
import { DownloadIcon, ExportLink } from "@/components/ExportButtons";
import { setFiled } from "@/lib/events/filed";
import { fromDateTimeLocal } from "@/lib/datetime";
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
  // Picking events for the combined PDF: null when not exporting.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  // Ids of the last combined download, offered to be marked as filed.
  const [exported, setExported] = useState<string[] | null>(null);
  const [onlyUnfiled, setOnlyUnfiled] = useState(false);

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
        event_date: fromDateTimeLocal(data.event_date),
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
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function replaceEvents(updated: Event[]) {
    const byId = new Map(updated.map((e) => [e.id, e]));
    setEvents((prev) => prev.map((e) => byId.get(e.id) ?? e));
  }

  async function markFiled(ids: string[], filed: boolean) {
    setError(null);
    try {
      replaceEvents(await setFiled(ids, filed, userEmail));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the event.");
    }
  }

  function stopExport() {
    setSelected(null);
    setExported(null);
  }

  // "Your events" are the ones you created; "All events" lists everyone
  // else's (and older events without a creator), so nothing appears twice.
  const isMine = (e: Event) => !!userEmail && e.created_by?.toLowerCase() === userEmail;
  const shown = onlyUnfiled ? events.filter((e) => !e.filed_at) : events;
  const myEvents = shown.filter(isMine);
  const otherEvents = shown.filter((e) => !isMine(e));
  const count = selected?.size ?? 0;
  const tooMany = count > MAX_EXPORT_EVENTS;
  const listProps = {
    selected: selected ?? undefined,
    onToggle: toggle,
    onToggleFiled: (e: Event) => markFiled([e.id], !e.filed_at),
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mr-auto">Events</h1>
        <button
          onClick={() => (selected ? stopExport() : setSelected(new Set()))}
          aria-pressed={!!selected}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition-colors ${
            selected
              ? "border border-esn bg-esn/5 text-esn"
              : "border border-gray-300 bg-white text-gray-700 hover:border-esn hover:text-esn"
          }`}
        >
          <DownloadIcon />
          Export PDF
        </button>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-esn text-white text-sm px-4 py-2 rounded-lg shadow-sm hover:bg-esn-dark transition-colors"
        >
          {showForm ? "Cancel" : "+ New Event"}
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2 mb-6">{error}</p>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Event</h2>
          <EventForm onSubmit={handleCreate} loading={submitting} defaultResponsible={userName} />
        </div>
      )}

      {selected && (
        <div className="sticky top-2 z-10 bg-white rounded-xl shadow-md border border-esn/30 px-4 py-3 mb-6">
          {exported ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-700 mr-auto">
                Downloaded {exported.length} {exported.length === 1 ? "list" : "lists"}. Printed and put into the office?
              </span>
              <button
                onClick={async () => {
                  await markFiled(exported, true);
                  stopExport();
                }}
                className="bg-green-600 text-white text-sm px-3.5 py-2 rounded-lg shadow-sm hover:bg-green-700 transition-colors"
              >
                ✓ Mark as filed
              </button>
              <button onClick={stopExport} className="text-sm text-gray-500 hover:underline">
                Not now
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-700 mr-auto">
                {count === 0 ? "Select the signed-off events to export" : `${count} selected`}
              </span>
              <button onClick={stopExport} className="text-sm text-gray-500 hover:underline">
                Cancel
              </button>
              {tooMany ? (
                <span className="text-sm text-red-500">At most {MAX_EXPORT_EVENTS} events</span>
              ) : count === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium bg-gray-200 text-gray-400 cursor-not-allowed">
                  <DownloadIcon />
                  Download PDF
                </span>
              ) : (
                <ExportLink
                  href={`/api/export/events/pdf?ids=${[...selected].join(",")}`}
                  label={`Download PDF (${count})`}
                  onClick={() => setExported([...selected])}
                  primary
                />
              )}
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-600 mb-3 px-1">
        <input
          type="checkbox"
          checked={onlyUnfiled}
          onChange={(e) => setOnlyUnfiled(e.target.checked)}
          className="h-4 w-4 accent-esn"
        />
        Only lists not yet filed in the office
      </label>

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
              emptyText={onlyUnfiled ? "All your lists are filed." : "You haven't created any events yet."}
              {...listProps}
            />
          </section>
          <section aria-labelledby="all-events" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 id="all-events" className="text-lg font-semibold mb-4">All events</h2>
            <EventList
              events={otherEvents}
              emptyText={onlyUnfiled ? "All other lists are filed." : "No other events."}
              {...listProps}
            />
          </section>
        </div>
      )}
    </main>
  );
}
