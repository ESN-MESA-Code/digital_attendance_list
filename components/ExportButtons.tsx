"use client";

interface Props {
  eventId: string;
}

export default function ExportButtons({ eventId }: Props) {
  return (
    <div className="flex gap-3">
      <a
        href={`/api/export/event/${eventId}/csv`}
        download
        className="inline-flex items-center gap-1 bg-green-600 text-white text-sm px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
      >
        Export CSV
      </a>
      <a
        href={`/api/export/event/${eventId}/pdf`}
        download
        className="inline-flex items-center gap-1 bg-red-600 text-white text-sm px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
      >
        Export PDF
      </a>
    </div>
  );
}
