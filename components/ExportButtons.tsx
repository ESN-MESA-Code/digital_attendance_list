"use client";

import { useState } from "react";
import { DEFAULT_EXPORT_LANG, EXPORT_LANGUAGES, type Lang } from "@/lib/countries";

interface Props {
  eventId: string;
}

export default function ExportButtons({ eventId }: Props) {
  // Language of the country names in the exported file.
  const [lang, setLang] = useState<Lang>(DEFAULT_EXPORT_LANG);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        Countries in
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-esn-accent"
        >
          {Object.entries(EXPORT_LANGUAGES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <a
        href={`/api/export/event/${eventId}/csv?lang=${lang}`}
        download
        className="inline-flex items-center gap-1 bg-green-600 text-white text-sm px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
      >
        Export CSV
      </a>
      <a
        href={`/api/export/event/${eventId}/pdf?lang=${lang}`}
        download
        className="inline-flex items-center gap-1 bg-red-600 text-white text-sm px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
      >
        Export PDF
      </a>
    </div>
  );
}
