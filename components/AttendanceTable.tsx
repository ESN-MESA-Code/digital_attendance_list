"use client";

import type { Participant } from "@/types";
import Image from "next/image";
import { countryName, DEFAULT_EXPORT_LANG } from "@/lib/countries";

interface Props {
  participants: Participant[];
}

// Phones get a small card per person (name on the first line, the rest on the
// second, the signature to the right); wider screens get the full table.
const SHORT_PROGRAMME: Record<string, string> = {
  "Erasmus+": "Eras+",
  LMUexchange: "LMUex",
  "Full-time degree": "FT",
  Other: "Oth",
};

function time(p: Participant) {
  return new Date(p.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function KioskBadge({ p, short = false }: { p: Participant; short?: boolean }) {
  if (p.entry_method !== "kiosk") return null;
  return (
    <span
      title={`Signed in on ${p.recorded_by ?? "an organiser"}'s device`}
      className="align-middle rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500"
    >
      {short ? "K" : "Kiosk"}
    </span>
  );
}

function Signature({ p, className }: { p: Participant; className: string }) {
  if (!p.signature) return <span className="text-gray-400">—</span>;
  return (
    <Image
      src={p.signature}
      alt={`${p.first_name} ${p.last_name} signature`}
      width={120}
      height={40}
      className={`object-contain border border-gray-200 rounded bg-white ${className}`}
      unoptimized
    />
  );
}

export default function AttendanceTable({ participants }: Props) {
  if (participants.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4 text-center">
        No participants yet.
      </p>
    );
  }

  return (
    <>
      <ul className="sm:hidden divide-y divide-gray-200">
        {participants.map((p, idx) => {
          const country = countryName(p.nationality, DEFAULT_EXPORT_LANG);
          const details = [
            p.nationality,
            p.university === "Other" ? "Oth" : p.university,
            SHORT_PROGRAMME[p.exchange_program] ?? p.exchange_program,
            p.esn_card === null ? null : `ESN ${p.esn_card ? "✓" : "–"}`,
            time(p),
          ].filter(Boolean);
          return (
            <li
              key={p.id}
              data-testid="participant-card"
              className="grid grid-cols-[1fr_auto] items-center gap-x-2 px-1 py-1.5"
            >
              <p className="min-w-0 truncate text-sm font-medium text-gray-900" title={`${p.first_name} ${p.last_name}`}>
                <span className="mr-1.5 text-xs font-normal text-gray-400">{idx + 1}</span>
                {p.first_name} {p.last_name}
              </p>
              <div className="row-span-2">
                <Signature p={p} className="block h-10 w-[7.5rem]" />
              </div>
              <p
                className="min-w-0 truncate text-xs text-gray-500"
                title={`${country} · ${p.university} · ${p.exchange_program}`}
              >
                {details.join(" · ")} <KioskBadge p={p} short />
              </p>
            </li>
          );
        })}
      </ul>

      <div className="hidden sm:block relative overflow-x-auto">
        <table className="min-w-full text-sm text-left whitespace-nowrap">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
              <th className="px-3 py-2 whitespace-nowrap">#</th>
              <th className="px-3 py-2 whitespace-nowrap">Surname</th>
              <th className="px-3 py-2 whitespace-nowrap">First Name</th>
              <th className="px-3 py-2 whitespace-nowrap">Nationality</th>
              <th className="px-3 py-2 whitespace-nowrap">University</th>
              <th className="px-3 py-2 whitespace-nowrap">Exchange Programme</th>
              <th className="px-3 py-2 whitespace-nowrap">ESNcard</th>
              <th className="px-3 py-2 whitespace-nowrap">Signature</th>
              <th className="px-3 py-2 whitespace-nowrap">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {participants.map((p, idx) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-gray-900">
                  {p.last_name} <KioskBadge p={p} />
                </td>
                <td className="px-3 py-2 text-gray-700">{p.first_name}</td>
                <td className="px-3 py-2 text-gray-600">{countryName(p.nationality, DEFAULT_EXPORT_LANG)}</td>
                <td className="px-3 py-2 text-gray-600">{p.university ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600">{p.exchange_program ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600">
                  {p.esn_card === null ? "—" : p.esn_card ? "Yes" : "No"}
                </td>
                <td className="px-3 py-2">
                  <Signature p={p} className="h-10 w-[7.5rem]" />
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{time(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
