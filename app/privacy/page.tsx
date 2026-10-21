import type { Metadata } from "next";
import LegalPage, { A, Address, H2, H3, List } from "@/components/LegalPage";
import {
  ASSOCIATION,
  DATA_PROTECTION_OFFICER,
  PROCESSORS,
  RETENTION_YEARS,
  SUPERVISORY_AUTHORITY,
} from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy notice – MES Attendance" };

// Information under Art. 13 GDPR. The German version (/datenschutz) says the
// same; change both together.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      lang="en"
      switchTo={{ href: "/datenschutz", label: "Deutsche Fassung" }}
    >
      <p>
        This notice explains which personal data the MES Attendance app collects when you sign
        in to a MESA event, why we need it, how long we keep it and what rights you have. It
        covers this app only; our main website has its own privacy notice.
      </p>

      <H2>1. Who is responsible</H2>
      <Address lines={[ASSOCIATION.name, ...ASSOCIATION.address]} />
      <p>
        Email: <A href={`mailto:${ASSOCIATION.email}`} />
      </p>

      <H2>2. Data protection officer</H2>
      <p>
        {DATA_PROTECTION_OFFICER.name}, <A href={`mailto:${DATA_PROTECTION_OFFICER.email}`} />{" "}
        (postal address as above, marked “Datenschutzbeauftragter”). You can contact the data
        protection officer with any question about your data.
      </p>

      <H2>3. Signing in to an event</H2>
      <H3>What we collect</H3>
      <p>
        When you sign in to an event – on your own phone through the QR code, or on an
        organiser&apos;s device – we store:
      </p>
      <List>
        <li>first and last name</li>
        <li>nationality</li>
        <li>university and exchange programme</li>
        <li>whether you have an ESNcard</li>
        <li>your handwritten signature (as a small image)</li>
        <li>
          the time of signing in, and whether you signed in on your own device or on an
          organiser&apos;s device (in that case, which organiser&apos;s)
        </li>
      </List>
      <p>
        Your signature also confirms that you accepted the event&apos;s liability disclaimer.
      </p>

      <H3>Why, and on which legal basis</H3>
      <List>
        <li>
          to document who attended the event, as a signed attendance list including your
          acceptance of the liability disclaimer;
        </li>
        <li>
          to prove to the bodies that fund our events (for example the programme “Lokale
          Erasmus+ Initiativen”) and for our accounting that the event took place and who took
          part;
        </li>
        <li>
          for statistics without names (for example how many participants came from which
          university or country) for reports to funders and for planning our events.
        </li>
      </List>
      <p>
        The legal basis is our legitimate interest in documenting our events, proving the
        proper use of funds and planning our work (Art. 6(1)(f) GDPR). Where we have to keep the
        lists as records under tax or funding rules, the legal basis is also that legal
        obligation (Art. 6(1)(c) GDPR).
      </p>

      <H3>Do you have to provide the data?</H3>
      <p>
        No law or contract obliges you to. Without these details we cannot record your
        attendance, though. If you would rather not sign in digitally, please talk to the
        organisers.
      </p>

      <H3>Who sees it</H3>
      <p>
        Only MESA organisers who sign in with their personal @esnmesa.org account can see the
        sign-ins. Participants cannot see each other&apos;s details. After the event the
        organiser signs the list off, and a printed copy is kept in a folder in our office.
        Funding bodies or auditors may see the lists if they check how funds were used. Apart
        from that, we do not pass your data on, and we never sell it or use it for advertising.
      </p>

      <H3>How long we keep it</H3>
      <p>
        Sign-ins are deleted automatically at the end of the {ordinal(RETENTION_YEARS)} calendar
        year after the event (for an event in 2026: at the end of {2026 + RETENTION_YEARS}). We
        keep them this long because funders and the tax rules may ask for the lists as proof
        for that period. Printed lists are destroyed at the same time.
      </p>

      <H2>4. “Save my details” on your device</H2>
      <p>
        After signing in you can choose to save your name, nationality, university, exchange
        programme and ESNcard status in a cookie on your device, so the form is filled in for
        you at the next event. Your signature is never saved there. The cookie is only set if
        you click “Save my details”, it stays only on your device (we do not store it on our
        servers) and it expires after 12 months.
      </p>
      <p>
        The legal basis is your consent (§ 25(1) TDDDG, Art. 6(1)(a) GDPR). You can withdraw it
        at any time with effect for the future: click “Not you? Remove saved details” or “Remove
        them” in the form, or delete the cookies of this site in your browser.
      </p>

      <H2>5. Organiser login</H2>
      <p>
        Organisers sign in with their MESA Google Workspace account (@esnmesa.org), provided by{" "}
        {PROCESSORS.login.name}, {PROCESSORS.login.address}. We receive the organiser&apos;s name,
        email address, profile picture and account ID from Google. The app records which
        organiser created an event, recorded a sign-in on their device, signed a list off (with
        their signature) and filed it. The profile picture is loaded from Google&apos;s servers,
        which therefore see the organiser&apos;s IP address. The legal basis is our legitimate
        interest in secure access and in knowing who is responsible for each list (Art. 6(1)(f)
        GDPR). This data is kept as long as the events it belongs to.
      </p>
      <p>
        Signing in sets cookies that hold the login session. They are strictly necessary for
        the organiser area and need no consent (§ 25(2) No. 2 TDDDG). Participants get no
        cookies apart from the optional one in section 4.
      </p>

      <H2>6. Hosting and server logs</H2>
      <p>
        The app is hosted by {PROCESSORS.hosting.name}, {PROCESSORS.hosting.address}, on servers
        in the EU. The data is stored in a database of {PROCESSORS.database.name},{" "}
        {PROCESSORS.database.address}, located in Frankfurt am Main, Germany. When you open the
        app, these providers automatically process technical data: your IP address, date and
        time, the page requested, and your browser and operating system. They need it to
        deliver the app and keep it secure, and keep it only for a short time in their logs. The
        legal basis is our legitimate interest in running the app reliably and securely (Art.
        6(1)(f) GDPR).
      </p>

      <H2>7. Service providers and transfers outside the EU</H2>
      <p>
        Vercel, Supabase and Google process data on our behalf, under data processing
        agreements (Art. 28 GDPR). Although the data is stored in the EU, these companies or
        their subcontractors may access it from countries outside the EU, in particular the
        USA, for example for support or security. Such transfers rely on the EU–US Data Privacy
        Framework where the company is certified under it, and otherwise on the EU standard
        contractual clauses (Art. 46(2)(c) GDPR). Privacy information of the providers:{" "}
        <A href={PROCESSORS.hosting.privacy}>Vercel</A>,{" "}
        <A href={PROCESSORS.database.privacy}>Supabase</A>,{" "}
        <A href={PROCESSORS.login.privacy}>Google</A>.
      </p>

      <H2>8. No tracking</H2>
      <p>
        The app uses no analytics, tracking or advertising tools and loads no fonts or scripts
        from other sites. We make no automated decisions about you (Art. 22 GDPR).
      </p>

      <H2>9. Your rights</H2>
      <p>You have the right to</p>
      <List>
        <li>access the data we hold about you and get a copy (Art. 15 GDPR),</li>
        <li>have incorrect data corrected (Art. 16 GDPR),</li>
        <li>have your data deleted (Art. 17 GDPR),</li>
        <li>have its processing restricted (Art. 18 GDPR),</li>
        <li>receive the data you gave us in a machine-readable format (Art. 20 GDPR),</li>
        <li>withdraw your consent at any time with effect for the future (Art. 7(3) GDPR).</li>
      </List>
      <p className="font-semibold">
        Right to object (Art. 21 GDPR): where we process your data on the basis of our
        legitimate interest, you can object at any time on grounds relating to your particular
        situation. We then stop processing it unless we have compelling legitimate grounds, or
        need it to establish, exercise or defend legal claims.
      </p>
      <p>
        To use these rights, email the data protection officer at{" "}
        <A href={`mailto:${DATA_PROTECTION_OFFICER.email}`} /> or write to{" "}
        <A href={`mailto:${ASSOCIATION.email}`} />.
      </p>
      <p>
        You also have the right to complain to a data protection supervisory authority (Art. 77
        GDPR). The authority responsible for us is the {SUPERVISORY_AUTHORITY.name},{" "}
        {SUPERVISORY_AUTHORITY.address}, <A href={SUPERVISORY_AUTHORITY.website} />.
      </p>

      <H2>10. Security</H2>
      <p>
        All connections are encrypted (HTTPS). Sign-ins can only be read with an @esnmesa.org
        login, which the database itself enforces, and signatures are never publicly
        accessible.
      </p>

      <p className="pt-4 text-gray-500">As of October 2026</p>
    </LegalPage>
  );
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
