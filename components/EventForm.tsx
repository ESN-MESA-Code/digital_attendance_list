"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toDateTimeLocal } from "@/lib/datetime";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  event_date: z.string().min(1, "Event date is required"),
  risk_notice: z.string().trim().max(2000, "At most 2000 characters"),
});

export type EventFormData = z.infer<typeof schema>;
type FormData = EventFormData;

interface Props {
  /** event_date arrives as a local "YYYY-MM-DDTHH:mm" (see lib/datetime); risk_notice "" for none. */
  onSubmit: (data: FormData) => Promise<void>;
  loading?: boolean;
  /** Editing: the event's current values (the form is not cleared after saving). */
  initialValues?: FormData;
  onCancel?: () => void;
  /**
   * People have signed in: date and risk notice are fixed (the database
   * refuses changes too), only the title can still be corrected. Read-only
   * rather than disabled, which would drop their values from the form.
   */
  lockSignInFields?: boolean;
}

// Only what the attendance list needs. The responsible MESA member is always
// the creator (set by the database from their Google account).

/** A new event starts at the time it is created; change it if needed. */
function newEventDefaults(): Partial<FormData> {
  return { event_date: toDateTimeLocal(new Date().toISOString()), risk_notice: "" };
}

const inputClass =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent read-only:bg-gray-100 read-only:text-gray-500";

export default function EventForm({
  onSubmit,
  loading,
  initialValues,
  onCancel,
  lockSignInFields = false,
}: Props) {
  const editing = initialValues !== undefined;
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? newEventDefaults(),
  });

  async function handleFormSubmit(data: FormData) {
    await onSubmit(data);
    if (!editing) reset(newEventDefaults());
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input {...register("title")} type="text" placeholder="Event title" className={inputClass} />
        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Event Date <span className="text-red-500">*</span>
        </label>
        <input
          {...register("event_date")}
          type="datetime-local"
          readOnly={lockSignInFields}
          className={inputClass}
        />
        {errors.event_date && <p className="text-red-500 text-xs mt-1">{errors.event_date.message}</p>}
        <p className="text-xs text-gray-400 mt-1">
          People can sign in from 2 hours before until 24 hours after this time.
        </p>
      </div>

      <div>
        <label htmlFor="risk_notice" className="block text-sm font-medium text-gray-700 mb-1">
          Risk notice <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          {...register("risk_notice")}
          id="risk_notice"
          rows={3}
          readOnly={lockSignInFields}
          placeholder="E.g. for hikes or sports: the risks of the activity and what participants need (fitness, shoes, equipment)."
          className={inputClass}
        />
        {errors.risk_notice && <p className="text-red-500 text-xs mt-1">{errors.risk_notice.message}</p>}
        <p className="text-xs text-gray-400 mt-1">
          Shown above the participation terms; participants accept it when signing in.
        </p>
      </div>

      {lockSignInFields && (
        <p className="text-xs text-gray-500">
          People have signed in already, so the date and risk notice cannot change any more.
        </p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-esn text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-esn-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {editing ? (loading ? "Saving…" : "Save changes") : loading ? "Creating…" : "Create Event"}
        </button>
      </div>
    </form>
  );
}
