"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Participant } from "@/types";

const COLUMNS =
  "id, event_id, first_name, last_name, nationality, university, exchange_program, esn_card, signature, entry_method, recorded_by, created_at";

export function useParticipants(eventId: string) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchParticipants() {
      const { data, error } = await supabase
        .from("participants")
        .select(COLUMNS)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setParticipants(data as Participant[]);
      }
      setLoading(false);
    }

    fetchParticipants();

    const channel = supabase
      .channel(`participants:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const added = payload.new as Participant;
          setParticipants((prev) =>
            prev.some((p) => p.id === added.id) ? prev : [...prev, added]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return { participants, loading };
}
