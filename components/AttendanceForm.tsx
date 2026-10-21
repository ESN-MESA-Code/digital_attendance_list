"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import { isCountryCode, matchCountry } from "@/lib/countries";
import CountryCombobox from "@/components/CountryCombobox";
import {
  forgetSavedDetails,
  loadSavedDetails,
  saveDetails,
  type SavedDetails,
} from "@/lib/savedDetails";
import { NOTICE_VERSION } from "@/lib/legal";
import type { FormTexts, PublicEvent } from "@/types";

const UNIVERSITIES = ["LMU", "TUM", "Other"] as const;
const EXCHANGE_PROGRAMS = ["Erasmus+", "LMUexchange", "Full-time degree", "Other"] as const;

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  nationality: z
    .string()
    .min(1, "Nationality is required")
    // ISO code from the country picker (raw text while nothing matches).
    .refine(isCountryCode, "Please pick a country from the list"),
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

// details and disclaimer → signature on its own page → (submitted) →
// ask to remember details → done
type Step = "form" | "sign" | "save" | "done";

const inputClass =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent";

// Seconds the kiosk "thank you" screen stays up before the next person's form.
const KIOSK_RESET_SECONDS = 5;

/** Shown instead of the form once the organiser signed the event off. */
export function SignInsClosed({ title }: { title: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-sm w-full">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign-ins are closed</h2>
        <p className="text-gray-600 text-sm">
          The attendance list for <span className="font-medium">{title}</span> has been signed
          off by the organiser. Please talk to them if you attended but could not sign in.
        </p>
      </div>
    </main>
  );
}

interface Props {
  event: PublicEvent;
  /** Disclaimer and data processing notice from legal/ */
  texts: FormTexts;
  /**
   * Set when the form runs on an organiser's device for participants without
   * a phone or internet. Saved details are neither offered nor pre-filled
   * (the device is shared) and the form starts over after each sign-in.
   */
  kiosk?: {
    /** Email of the signed-in organiser */
    recordedBy: string;
    /** Called when the next person may sign in */
    onNext: () => void;
  };
}

export default function AttendanceForm({ event, texts, kiosk }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  // Whether the form was pre-filled from details saved on this device.
  const [usedSaved, setUsedSaved] = useState(false);
  const [submittedDetails, setSubmittedDetails] = useState<SavedDetails | null>(null);
  // The checked answers from the first page, while the participant signs.
  const [answers, setAnswers] = useState<FormData | null>(null);
  // The event was signed off while the form was open.
  const [closed, setClosed] = useState(event.closed);
  const sigPadRef = useRef<SignaturePadHandle>(null);
  const isKiosk = kiosk !== undefined;
  const onNext = kiosk?.onNext;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { nationality: "" } });

  useEffect(() => {
    if (isKiosk) return;
    const saved = loadSavedDetails();
    if (saved) {
      // Values come from a cookie – anything invalid is caught by validation on submit.
      reset({
        ...saved,
        // Cookies saved before codes were used hold a country name.
        nationality: isCountryCode(saved.nationality)
          ? saved.nationality
          : (matchCountry(saved.nationality) ?? ""),
        disclaimer_accepted: false,
      } as FormData);
      setUsedSaved(true);
    }
  }, [isKiosk, reset]);

  // Kiosk: show the thank-you screen briefly, then start over for the next person.
  const [secondsLeft, setSecondsLeft] = useState(KIOSK_RESET_SECONDS);
  useEffect(() => {
    if (!onNext || step !== "done") return;
    if (secondsLeft <= 0) {
      onNext();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [onNext, step, secondsLeft]);

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

  function goToSignature(data: FormData) {
    setAnswers(data);
    setError(null);
    setStep("sign");
    window.scrollTo(0, 0);
  }

  async function submitAttendance() {
    const data = answers;
    if (!data) return;
    if (sigPadRef.current?.isEmpty()) {
      setError("Please provide your signature.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const signature = await sigPadRef.current!.toPng();
      if (!signature) throw new Error("Please provide your signature.");

      const details: SavedDetails = {
        first_name: data.first_name,
        last_name: data.last_name,
        nationality: data.nationality,
        university: data.university,
        exchange_program: data.exchange_program,
        esn_card: data.esn_card,
      };

      // No .select(): participants cannot (and must not) read rows back.
      const { error: insertError } = await supabase.from("participants").insert({
        event_id: event.id,
        first_name: details.first_name,
        last_name: details.last_name,
        nationality: details.nationality,
        university: details.university,
        exchange_program: details.exchange_program,
        esn_card: details.esn_card === "yes",
        signature,
        // The data processing notice this person was shown (Art. 5(2) GDPR).
        notice_version: NOTICE_VERSION,
        // Self sign-ins rely on the column defaults ('self', null).
        ...(kiosk && { entry_method: "kiosk", recorded_by: kiosk.recordedBy }),
      });

      if (insertError) {
        // RLS refuses sign-ins for events that were signed off meanwhile.
        if (insertError.code === "42501") {
          setClosed(true);
          return;
        }
        throw insertError;
      }

      if (isKiosk) {
        // Shared device – never remember anyone's details.
        setStep("done");
      } else {
        // Details are only stored when the participant says yes – every time.
        setSubmittedDetails(details);
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

  if (closed) return <SignInsClosed title={event.title} />;

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
                {usedSaved ? "Keep your details saved for next time?" : "Save your details for next time?"}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                We can store your name, nationality, university, exchange programme and
                ESNcard status in a cookie on this device, so the form is filled in
                automatically at the next event. Your signature is not saved.
                {usedSaved
                  ? " “No, thanks” removes the details saved earlier."
                  : " Nothing is stored unless you choose to save."}
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
                  onClick={() => {
                    // Declining also withdraws an earlier yes.
                    forgetSavedDetails();
                    setUsedSaved(false);
                    setStep("done");
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-3 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  No, thanks
                </button>
              </div>
            </div>
          )}

          {kiosk && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Please hand the device back to the organiser. The form opens again for
                the next person in {secondsLeft} s.
              </p>
              <button
                onClick={kiosk.onNext}
                className="mt-4 w-full bg-esn text-white py-2 px-3 rounded-md text-sm font-medium hover:bg-esn-dark transition-colors"
              >
                Next person
              </button>
            </div>
          )}

          {!kiosk && step === "done" && loadSavedDetails() && (
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
            <p className="text-xs text-gray-400 mt-1">
              {new Date(event.event_date).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          {usedSaved && step === "form" && (
            <div className="mb-4 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-gray-700">
              We filled in your saved details – please check them, then continue to sign.{" "}
              <button type="button" onClick={handleForget} className="text-esn underline">
                Not you? Remove saved details
              </button>
            </div>
          )}

          {/* Hidden, not unmounted, while signing: "Back" finds every answer as left. */}
          <form onSubmit={handleSubmit(goToSignature)} className="space-y-4" hidden={step !== "form"}>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Step 1 of 2 · Your details</p>
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

            {/* Nationality – type to search, validated against the list */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nationality <span className="text-red-500">*</span>
              </label>
              <Controller
                name="nationality"
                control={control}
                render={({ field }) => (
                  <CountryCombobox
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Start typing your country…"
                    className={inputClass}
                  />
                )}
              />
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

            {/* Disclaimer (legal/form-disclaimer.en.md) */}
            <div className="legal-box" dangerouslySetInnerHTML={{ __html: texts.disclaimer }} />

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

            {/* Art. 13 GDPR: the essentials at the point of collection
                (legal/form-data-processing.en.md); the full notice is linked in
                the page footer. */}
            <div className="legal-box" dangerouslySetInnerHTML={{ __html: texts.dataProcessing }} />

            <button
              type="submit"
              className="w-full bg-esn text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-esn-dark transition-colors"
            >
              Continue to signature →
            </button>
          </form>

          {step === "sign" && answers && (
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Step 2 of 2 · Signature</p>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Please sign, {answers.first_name} {answers.last_name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Your signature confirms your attendance and that you accept the disclaimer.
                </p>
              </div>

              <SignaturePad ref={sigPadRef} />

              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("form");
                  }}
                  disabled={submitting}
                  className="border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={submitAttendance}
                  disabled={submitting}
                  className="flex-1 bg-esn text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-esn-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? "Submitting…" : "Submit attendance"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
