"use client";

import type { Participant } from "@/types";
import Image from "next/image";
import { countryName, DEFAULT_EXPORT_LANG } from "@/lib/countries";

interface Props {
  participants: Participant[];
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
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left">
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
                {p.last_name}
                {p.entry_method === "kiosk" && (
                  <span
                    title={`Signed in on ${p.recorded_by ?? "an organiser"}'s device`}
                    className="ml-2 align-middle rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500"
                  >
                    Kiosk
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-700">{p.first_name}</td>
              <td className="px-3 py-2 text-gray-600">{countryName(p.nationality, DEFAULT_EXPORT_LANG)}</td>
              <td className="px-3 py-2 text-gray-600">{p.university ?? "—"}</td>
              <td className="px-3 py-2 text-gray-600">{p.exchange_program ?? "—"}</td>
              <td className="px-3 py-2 text-gray-600">
                {p.esn_card === null ? "—" : p.esn_card ? "Yes" : "No"}
              </td>
              <td className="px-3 py-2">
                {p.signature_url ? (
                  <Image
                    src={p.signature_url}
                    alt={`${p.first_name} ${p.last_name} signature`}
                    width={80}
                    height={40}
                    className="border border-gray-200 rounded bg-white"
                    unoptimized
                  />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                {new Date(p.created_at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
