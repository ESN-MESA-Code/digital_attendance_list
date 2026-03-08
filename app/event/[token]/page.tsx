"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase/client";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import type { Event } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z
    .string()
    .optional()
    .transform((val) => (val === "" ? undefined : val))
    .pipe(z.string().email("Invalid email").optional()),
  organization: z.string().optional(),
  disclaimer_accepted: z.boolean().refine((v) => v === true, {
    message: "You must accept the disclaimer to continue.",
  }),
});

type FormData = z.infer<typeof schema>;

export default function AttendancePage() {
  const { token } = useParams<{ token: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sigPadRef = useRef<SignaturePadHandle>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    async function fetchEvent() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("public_token", token)
        .single();
      if (!error && data) setEvent(data as Event);
      setLoading(false);
    }
    fetchEvent();
  }, [token]);

  async function onSubmit(data: FormData) {
    if (!event) return;
    if (sigPadRef.current?.isEmpty()) {
      setError("Please provide your signature.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Convert signature to PNG blob
      const dataUrl = sigPadRef.current!.toDataURL();
      const base64 = dataUrl.split(",")[1];
      const byteString = atob(base64);
      const byteArray = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "image/png" });

      // Create participant record first to get the id
      const participantId = crypto.randomUUID();
      const filePath = `${event.id}/${participantId}.png`;

      // Upload signature to storage
      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(filePath, blob, { contentType: "image/png", upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("signatures")
        .getPublicUrl(filePath);

      const signatureUrl = publicUrlData.publicUrl;

      // Insert participant
      const { error: insertError } = await supabase.from("participants").insert({
        id: participantId,
        event_id: event.id,
        name: data.name,
        email: data.email || null,
        organization: data.organization || null,
        signature_url: signatureUrl,
      });

      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading event…</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium">Event not found.</p>
          <p className="text-gray-400 text-sm mt-1">This link may be invalid or expired.</p>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
          <p className="text-gray-600 text-sm">
            Your attendance for <span className="font-medium">{event.title}</span> has been recorded.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-10">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-lg w-full overflow-hidden">
        {/* ESN branding strip */}
        <div className="bg-esn px-6 py-4 flex items-center gap-3">
          <span className="text-xl font-black text-esn-accent leading-none" aria-hidden="true">✦</span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-extrabold text-white tracking-tight">ESN</span>
            <span className="text-[10px] text-white/80 -mt-0.5 tracking-wide">MESA München</span>
          </div>
        </div>

        <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          {event.description && (
            <p className="text-gray-500 text-sm mt-1">{event.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(event.event_date).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register("name")}
              type="text"
              placeholder="Your full name"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              {...register("email")}
              type="email"
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              {...register("organization")}
              type="text"
              placeholder="Your organization"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signature <span className="text-red-500">*</span>
            </label>
            <SignaturePad ref={sigPadRef} />
          </div>

          {/* Disclaimer */}
          <div className="rounded-md border border-gray-300 bg-gray-50 p-4 text-xs text-gray-700 space-y-3">
            <div>
              <p className="font-bold uppercase tracking-wide mb-1">Haftungsausschluss</p>
              <p>
                Jegliche Haftung von MESA e.V. ist auf einer grob fahrlässigen Pflichtverletzung
                oder auf einer vorsätzlichen Pflichtverletzung seitens MESA e.V. beschränkt.
                Jede*r Teilnehmer*in ist volljährig und komplett selbst verantwortlich für die
                eigenen Handlungen; für eventuelle hieraus entstehende Schäden ist MESA e.V.
                nicht haftbar. Die Teilnahme erfolgt auf eigene Gefahr.
              </p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wide mb-1">Disclaimer</p>
              <p>
                The responsibility of MESA e.V. is limited to gross breach of duty or
                infringement on behalf of MESA e.V. Every participant is of legal full age and
                is fully responsible for his or her actions; MESA e.V. is not responsible for
                damages caused by the participants. The participation in this event is at your
                own risk.
              </p>
            </div>
          </div>

          {/* Disclaimer acceptance checkbox */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                {...register("disclaimer_accepted")}
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-esn focus:ring-esn-accent shrink-0"
              />
              <span className="text-sm text-gray-700">
                I have read and accept the Haftungsausschluss / Disclaimer above.{" "}
                <span className="text-red-500">*</span>
              </span>
            </label>
            {errors.disclaimer_accepted && (
              <p className="text-red-500 text-xs mt-1">
                {errors.disclaimer_accepted.message}
              </p>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-esn text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-esn-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Attendance"}
          </button>
        </form>
        </div>{/* /p-6 */}
      </div>
    </main>
  );
}
