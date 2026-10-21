"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import { COUNTRIES, matchCountry } from "@/lib/countries";
import {
  forgetSavedDetails,
  loadSavedDetails,
  saveDetails,
  type SavedDetails,
} from "@/lib/savedDetails";
import type { Event } from "@/types";

const UNIVERSITIES = ["LMU", "TUM", "Other"] as const;
const EXCHANGE_PROGRAMS = ["Erasmus+", "LMUexchange", "Full-time degree", "Other"] as const;

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  nationality: z
    .string()
    .min(1, "Nationality is required")
    .refine((v) => matchCountry(v) !== null, "Please pick a country from the list"),
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

// form → (submitted) → ask to remember details → done
type Step = "form" | "save" | "done";

const inputClass =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent";

export default function AttendancePage() {
  const { token } = useParams<{ token: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  // Whether the form was pre-filled from details saved on this device.
  const [usedSaved, setUsedSaved] = useState(false);
  const [submittedDetails, setSubmittedDetails] = useState<SavedDetails | null>(null);
  const sigPadRef = useRef<SignaturePadHandle>(null);

  const {
    register,
    handleSubmit,
    reset,
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

  useEffect(() => {
    const saved = loadSavedDetails();
    if (saved) {
      // Values come from a cookie – anything invalid is caught by validation on submit.
      reset({ ...saved, disclaimer_accepted: false } as FormData);
      setUsedSaved(true);
    }
  }, [reset]);

  function handleForget() {
    forgetSavedDetails();
    setUsedSaved(false);
    // "" leaves no radio selected; react-hook-form keeps a choice when a field is omitted.
    reset({
      first_name: "",
      last_name: "",
      nationality: "",
      university: "",
      exchange_program: "",
      esn_card: "",
      disclaimer_accepted: false,
    } as unknown as FormData);
  }

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

      const details: SavedDetails = {
        first_name: data.first_name,
        last_name: data.last_name,
        nationality: matchCountry(data.nationality)!,
        university: data.university,
        exchange_program: data.exchange_program,
        esn_card: data.esn_card,
      };

      // Insert participant
      const { error: insertError } = await supabase.from("participants").insert({
        id: participantId,
        event_id: event.id,
        first_name: details.first_name,
        last_name: details.last_name,
        nationality: details.nationality,
        university: details.university,
        exchange_program: details.exchange_program,
        esn_card: details.esn_card === "yes",
        signature_url: signatureUrl,
      });

      if (insertError) throw insertError;

      setSubmittedDetails(details);
      if (usedSaved) {
        // They agreed to be remembered before – keep the saved details current.
        saveDetails(details);
        setStep("done");
      } else {
        setStep("save");
      }
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

  if (step === "save" || step === "done") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
          <p className="text-gray-600 text-sm">
            Your attendance for <span className="font-medium">{event.title}</span> has been recorded.
          </p>

          {step === "save" && submittedDetails && (
            <div className="mt-6 pt-6 border-t border-gray-200 text-left">
              <h3 className="text-sm font-semibold text-gray-900">
                Save your details for next time?
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                We can store your name, nationality, university, exchange programme and
                ESNcard status in a cookie on this device, so the form is filled in
                automatically at the next event. Your signature is not saved. You can
                remove the saved details at any time from the form.
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    saveDetails(submittedDetails);
                    setStep("done");
                  }}
                  className="flex-1 bg-esn text-white py-2 px-3 rounded-md text-sm font-medium hover:bg-esn-dark transition-colors"
                >
                  Save my details
                </button>
                <button
                  onClick={() => setStep("done")}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-3 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  No, thanks
                </button>
              </div>
            </div>
          )}

          {step === "done" && loadSavedDetails() && (
            <p className="text-xs text-gray-500 mt-6">
              Your details are saved on this device for next time.{" "}
              <button
                onClick={() => {
                  forgetSavedDetails();
                  setUsedSaved(false);
                  setSubmittedDetails(null);
                }}
                className="text-esn underline"
              >
                Remove them
              </button>
            </p>
          )}
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

          {usedSaved && (
            <div className="mb-4 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-gray-700">
              We filled in your saved details – please check them and sign below.{" "}
              <button type="button" onClick={handleForget} className="text-esn underline">
                Not you? Remove saved details
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("first_name")}
                  type="text"
                  autoComplete="given-name"
                  className={inputClass}
                />
                {errors.first_name && (
                  <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("last_name")}
                  type="text"
                  autoComplete="family-name"
                  className={inputClass}
                />
                {errors.last_name && (
                  <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            {/* Nationality – free typing with suggestions, validated against the list */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nationality <span className="text-red-500">*</span>
              </label>
              <input
                {...register("nationality")}
                type="text"
                list="countries"
                autoComplete="off"
                placeholder="Start typing your country…"
                className={inputClass}
              />
              <datalist id="countries">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {errors.nationality && (
                <p className="text-red-500 text-xs mt-1">{errors.nationality.message}</p>
              )}
            </div>

            {/* University */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                University <span className="text-red-500">*</span>
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
                Exchange programme <span className="text-red-500">*</span>
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
                Do you have an ESNcard? <span className="text-red-500">*</span>
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
                Signature <span className="text-red-500">*</span>
              </label>
              <SignaturePad ref={sigPadRef} />
            </div>

            {/* Disclaimer */}
            <div className="rounded-md border border-gray-300 bg-gray-50 p-4 text-xs text-gray-700">
              <p className="font-bold uppercase tracking-wide mb-1">Disclaimer</p>
              <p>
                The responsibility of MESA e.V. is limited to gross breach of duty or
                infringement on behalf of MESA e.V. Every participant is of legal full age and
                is fully responsible for their actions; MESA e.V. is not responsible for
                damages caused by the participants. The participation in this event is at your
                own risk.
              </p>
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
                  I have read and accept the disclaimer above.{" "}
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
              {submitting ? "Submitting…" : "Submit attendance"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
