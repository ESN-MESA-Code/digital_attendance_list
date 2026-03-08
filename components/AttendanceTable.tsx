"use client";

import type { Participant } from "@/types";
import Image from "next/image";

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
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Organization</th>
            <th className="px-4 py-2">Signature</th>
            <th className="px-4 py-2">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {participants.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-medium text-gray-900">{p.name}</td>
              <td className="px-4 py-2 text-gray-600">{p.email ?? "—"}</td>
              <td className="px-4 py-2 text-gray-600">{p.organization ?? "—"}</td>
              <td className="px-4 py-2">
                {p.signature_url ? (
                  <Image
                    src={p.signature_url}
                    alt={`${p.name} signature`}
                    width={80}
                    height={40}
                    className="border border-gray-200 rounded bg-white"
                    unoptimized
                  />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
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
