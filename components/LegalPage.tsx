import Link from "next/link";

/** Frame and text styles shared by the Impressum and the privacy notices. */
export default function LegalPage({
  title,
  lang,
  switchTo,
  children,
}: {
  title: string;
  lang: "de" | "en";
  /** The same page in the other language */
  switchTo?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main lang={lang} className="max-w-3xl mx-auto px-4 py-10">
      <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-10 text-sm text-gray-700 leading-relaxed space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {switchTo && (
            <Link href={switchTo.href} className="text-esn hover:underline">
              {switchTo.label}
            </Link>
          )}
        </div>
        {children}
      </article>
    </main>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-gray-900 pt-4">{children}</h2>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-gray-900 pt-2">{children}</h3>;
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1">{children}</ul>;
}

export function A({ href, children }: { href: string; children?: React.ReactNode }) {
  return (
    <a href={href} className="text-esn hover:underline break-words">
      {children ?? href.replace(/^mailto:|^https:\/\//, "")}
    </a>
  );
}

/** A postal address, one line per entry. */
export function Address({ lines }: { lines: readonly string[] }) {
  return (
    <p>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}
