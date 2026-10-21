"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import type { Event } from "@/types";

const UNIVERSITIES = ["LMU", "TUM", "Other"] as const;
const EXCHANGE_PROGRAMS = ["Erasmus+", "LMUexchange", "Full-time degree", "Other"] as const;

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z
    .string()
    .optional()
    .transform((val) => (val === "" ? undefined : val))
    .pipe(z.string().email("Invalid email").optional()),
  nationality: z.string().min(1, "Nationality is required"),
  university: z.enum(UNIVERSITIES, { error: "Please select your university" }),
  exchange_program: z.enum(EXCHANGE_PROGRAMS, {
    error: "Please select your exchange programme",
  }),
  esn_card: z.enum(["yes", "no"], { error: "Please indicate if you have an ESNcard" }),
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
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || null,
        nationality: data.nationality,
        university: data.university,
        exchange_program: data.exchange_program,
        esn_card: data.esn_card === "yes",
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
          <Image
            src="/esn-mesa-logo-white.png"
            alt="ESN MESA München"
            width={600}
            height={334}
            priority
            className="h-12 w-auto"
          />
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
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name / Vorname <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("first_name")}
                  type="text"
                  placeholder="Vorname"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent"
                />
                {errors.first_name && (
                  <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name / Nachname <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("last_name")}
                  type="text"
                  placeholder="Nachname"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent"
                />
                {errors.last_name && (
                  <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            {/* Email */}
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

            {/* Nationality */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nationality / Nationalität <span className="text-red-500">*</span>
              </label>
              <input
                {...register("nationality")}
                type="text"
                placeholder="e.g. German, Italian, Spanish…"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent"
              />
              {errors.nationality && (
                <p className="text-red-500 text-xs mt-1">{errors.nationality.message}</p>
              )}
            </div>

            {/* University */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                University / Universität <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {UNIVERSITIES.map((uni) => (
                  <label key={uni} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                    <input
                      {...register("university")}
                      type="radio"
                      value={uni}
                      className="h-4 w-4 border-gray-300 text-esn focus:ring-esn-accent"
                    />
                    {uni}
                  </label>
                ))}
              </div>
              {errors.university && (
                <p className="text-red-500 text-xs mt-1">{errors.university.message}</p>
              )}
            </div>

            {/* Exchange Programme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exchange Programme / Austauschprogramm <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {EXCHANGE_PROGRAMS.map((prog) => (
                  <label key={prog} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                    <input
                      {...register("exchange_program")}
                      type="radio"
                      value={prog}
                      className="h-4 w-4 border-gray-300 text-esn focus:ring-esn-accent"
                    />
                    {prog}
                  </label>
                ))}
              </div>
              {errors.exchange_program && (
                <p className="text-red-500 text-xs mt-1">{errors.exchange_program.message}</p>
              )}
            </div>

            {/* ESNcard */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ESNcard <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                  <input
                    {...register("esn_card")}
                    type="radio"
                    value="yes"
                    className="h-4 w-4 border-gray-300 text-esn focus:ring-esn-accent"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                  <input
                    {...register("esn_card")}
                    type="radio"
                    value="no"
                    className="h-4 w-4 border-gray-300 text-esn focus:ring-esn-accent"
                  />
                  No
                </label>
              </div>
              {errors.esn_card && (
                <p className="text-red-500 text-xs mt-1">{errors.esn_card.message}</p>
              )}
            </div>

            {/* Signature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Signature / Unterschrift <span className="text-red-500">*</span>
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
        </div>
      </div>
    </main>
  );
}
