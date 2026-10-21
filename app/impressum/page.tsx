import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { A, Address, H2 } from "@/components/LegalPage";
import { ASSOCIATION, DATA_PROTECTION_OFFICER } from "@/lib/legal";

export const metadata: Metadata = { title: "Impressum – MES Attendance" };

// Legal notice under § 5 DDG and § 18 Abs. 1 MStV. German is the binding
// text; the English labels are for our international participants.
export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum / Legal notice" lang="de">
      <H2>Angaben gemäß § 5 DDG</H2>
      <Address lines={[ASSOCIATION.name, ...ASSOCIATION.address]} />
      <p>Beiname / Also known as: {ASSOCIATION.byname}</p>

      <H2>Vertreten durch den Vorstand / Represented by the board</H2>
      <p>
        {ASSOCIATION.board.map((member, i) => (
          <span key={member.name}>
            {member.name} ({member.de} / {member.en})
            {i < ASSOCIATION.board.length - 1 && <br />}
          </span>
        ))}
      </p>
      <p>
        Je zwei Vorstandsmitglieder vertreten den Verein gemeinsam. / Any two board members
        represent the association jointly.
      </p>

      <H2>Registereintrag / Register entry</H2>
      <p>
        Eingetragen im Vereinsregister / Registered association
        <br />
        Registergericht / Register court: {ASSOCIATION.registerCourt}
        <br />
        Registernummer / Register number: {ASSOCIATION.registerNumber}
      </p>

      <H2>Kontakt / Contact</H2>
      <p>
        E-Mail: <A href={`mailto:${ASSOCIATION.email}`} />
        <br />
        {ASSOCIATION.office.de}
        <br />
        <span lang="en">{ASSOCIATION.office.en}</span>
        <br />
        Website: <A href={ASSOCIATION.website} />
      </p>

      <H2>Datenschutz / Data protection</H2>
      <p>
        Datenschutzbeauftragter / Data protection officer: {DATA_PROTECTION_OFFICER.name},{" "}
        <A href={`mailto:${DATA_PROTECTION_OFFICER.email}`} />
        <br />
        <Link href="/datenschutz" className="text-esn hover:underline">
          Datenschutzerklärung
        </Link>{" "}
        /{" "}
        <Link href="/privacy" className="text-esn hover:underline">
          Privacy notice
        </Link>
      </p>
    </LegalPage>
  );
}
