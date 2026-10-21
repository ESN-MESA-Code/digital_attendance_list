"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toDateTimeLocal } from "@/lib/datetime";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  event_date: z.string().min(1, "Event date is required"),
});

export type EventFormData = z.infer<typeof schema>;
type FormData = EventFormData;

interface Props {
  /** event_date arrives as a local "YYYY-MM-DDTHH:mm" (see lib/datetime). */
  onSubmit: (data: FormData) => Promise<void>;
  loading?: boolean;
  /** Editing: the event's current values (the form is not cleared after saving). */
  initialValues?: FormData;
  onCancel?: () => void;
}

// Only what the attendance sheet needs. The responsible MESA member is always
// the creator (set by the database from their Google account); the LEI
// person signs the printed list by hand; there is no description field.

/** A new event starts at the time it is created; change it if needed. */
function newEventDefaults(): Partial<FormData> {
  return { event_date: toDateTimeLocal(new Date().toISOString()) };
}

export default function EventForm({
  onSubmit,
  loading,
  initialValues,
  onCancel,
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
        <input
          {...register("title")}
          type="text"
          placeholder="Event title"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent"
        />
        {errors.title && (
          <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Event Date <span className="text-red-500">*</span>
        </label>
        <input
          {...register("event_date")}
          type="datetime-local"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-esn-accent"
        />
        {errors.event_date && (
          <p className="text-red-500 text-xs mt-1">{errors.event_date.message}</p>
        )}
      </div>

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
