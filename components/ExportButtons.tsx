export function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.28 8.47a.75.75 0 0 0-1.06 1.06l4.25 4.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 1 0-1.06-1.06l-2.97 2.97V2.75Z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
  );
}

interface LinkProps {
  href: string;
  label: string;
  /** Accessible name and tooltip, when the label alone is terse. */
  description?: string;
  /** Called when the download starts. */
  onClick?: () => void;
  /** Filled ESN blue for the main action, outlined otherwise. */
  primary?: boolean;
}

/** A download link styled as a button, with a download icon. */
export function ExportLink({ href, label, description, onClick, primary = false }: LinkProps) {
  return (
    <a
      href={href}
      download
      onClick={onClick}
      title={description}
      aria-label={description}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-esn-accent focus-visible:ring-offset-1 ${
        primary
          ? "bg-esn text-white hover:bg-esn-dark"
          : "border border-gray-300 bg-white text-gray-700 hover:border-esn hover:text-esn"
      }`}
    >
      <DownloadIcon />
      {label}
    </a>
  );
}

interface Props {
  eventId: string;
  /** Why the PDF cannot be downloaded yet (it needs the organiser's sign-off). */
  pdfDisabledReason?: string;
}

export default function ExportButtons({ eventId, pdfDisabledReason }: Props) {
  return (
    <div className="flex items-center gap-2">
      <ExportLink href={`/api/export/event/${eventId}/csv`} label="CSV" description="Download as CSV" />
      {pdfDisabledReason ? (
        <span
          role="link"
          aria-disabled="true"
          aria-label="Download as PDF"
          title={pdfDisabledReason}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium bg-gray-200 text-gray-400 cursor-not-allowed"
        >
          <DownloadIcon />
          PDF
        </span>
      ) : (
        <ExportLink href={`/api/export/event/${eventId}/pdf`} label="PDF" description="Download as PDF" primary />
      )}
    </div>
  );
}
