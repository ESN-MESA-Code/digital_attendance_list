import type { Metadata } from "next";
import LegalPage, { A, Address, H2, H3, List } from "@/components/LegalPage";
import {
  ASSOCIATION,
  DATA_PROTECTION_OFFICER,
  PROCESSORS,
  RETENTION_YEARS,
  SUPERVISORY_AUTHORITY,
} from "@/lib/legal";

export const metadata: Metadata = { title: "Datenschutzerklärung – MES Attendance" };

// Informationen nach Art. 13 DSGVO. Die englische Fassung (/privacy) sagt
// dasselbe; beide zusammen ändern.
export default function DatenschutzPage() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      lang="de"
      switchTo={{ href: "/privacy", label: "English version" }}
    >
      <p>
        Diese Erklärung beschreibt, welche personenbezogenen Daten die App MES Attendance
        verarbeitet, wenn Sie sich bei einer Veranstaltung von MESA eintragen, wozu wir sie
        brauchen, wie lange wir sie speichern und welche Rechte Sie haben. Sie gilt nur für
        diese App; unsere Website hat eine eigene Datenschutzerklärung.
      </p>

      <H2>1. Verantwortlicher</H2>
      <Address lines={[ASSOCIATION.name, ...ASSOCIATION.address.slice(0, -1)]} />
      <p>
        E-Mail: <A href={`mailto:${ASSOCIATION.email}`} />
      </p>

      <H2>2. Datenschutzbeauftragter</H2>
      <p>
        {DATA_PROTECTION_OFFICER.name}, <A href={`mailto:${DATA_PROTECTION_OFFICER.email}`} />{" "}
        (Postanschrift wie oben, Zusatz „Datenschutzbeauftragter“). Sie können sich mit allen
        Fragen zu Ihren Daten an ihn wenden.
      </p>

      <H2>3. Eintragen in die Anwesenheitsliste</H2>
      <H3>Welche Daten</H3>
      <p>
        Wenn Sie sich für eine Veranstaltung eintragen – über den QR-Code auf Ihrem eigenen
        Gerät oder auf einem Gerät der Organisator*innen –, speichern wir:
      </p>
      <List>
        <li>Vor- und Nachname</li>
        <li>Staatsangehörigkeit</li>
        <li>Universität und Austauschprogramm</li>
        <li>ob Sie eine ESNcard haben</li>
        <li>Ihre handschriftliche Unterschrift (als kleines Bild)</li>
        <li>
          den Zeitpunkt des Eintrags und ob Sie sich auf Ihrem eigenen Gerät oder auf dem Gerät
          einer Organisatorin bzw. eines Organisators eingetragen haben (dann auch, auf wessen
          Gerät)
        </li>
      </List>
      <p>
        Mit Ihrer Unterschrift bestätigen Sie außerdem, dass Sie den Haftungsausschluss der
        Veranstaltung akzeptiert haben.
      </p>

      <H3>Zwecke und Rechtsgrundlagen</H3>
      <List>
        <li>
          Dokumentation, wer an der Veranstaltung teilgenommen hat, als unterschriebene
          Anwesenheitsliste einschließlich der Bestätigung des Haftungsausschlusses;
        </li>
        <li>
          Nachweis gegenüber den Stellen, die unsere Veranstaltungen fördern (zum Beispiel das
          Programm „Lokale Erasmus+ Initiativen“), und für unsere Buchhaltung, dass die
          Veranstaltung stattgefunden hat und wer teilgenommen hat;
        </li>
        <li>
          Statistiken ohne Namen (zum Beispiel wie viele Teilnehmende von welcher Universität
          oder aus welchem Land kamen) für Berichte an Fördergeber und für die Planung unserer
          Veranstaltungen.
        </li>
      </List>
      <p>
        Rechtsgrundlage ist unser berechtigtes Interesse, unsere Veranstaltungen zu
        dokumentieren, die ordnungsgemäße Verwendung von Fördermitteln nachzuweisen und unsere
        Arbeit zu planen (Art. 6 Abs. 1 lit. f DSGVO). Soweit wir die Listen nach steuer- oder
        förderrechtlichen Vorschriften aufbewahren müssen, ist Rechtsgrundlage zusätzlich diese
        rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO).
      </p>

      <H3>Müssen Sie die Daten angeben?</H3>
      <p>
        Sie sind dazu weder gesetzlich noch vertraglich verpflichtet. Ohne diese Angaben können
        wir Ihre Teilnahme aber nicht erfassen. Wenn Sie sich nicht digital eintragen möchten,
        sprechen Sie bitte die Organisator*innen an.
      </p>

      <H3>Wer die Daten sieht</H3>
      <p>
        Die Einträge können nur Organisator*innen von MESA sehen, die sich mit ihrem
        persönlichen @esnmesa.org-Konto anmelden. Teilnehmende sehen die Daten anderer nicht.
        Nach der Veranstaltung zeichnet die Organisatorin bzw. der Organisator die Liste ab;
        ein Ausdruck wird in einem Ordner in unserem Büro aufbewahrt. Fördergeber oder
        Prüfstellen können die Listen einsehen, wenn sie die Verwendung von Fördermitteln
        prüfen. Darüber hinaus geben wir Ihre Daten nicht weiter; wir verkaufen sie nie und
        nutzen sie nicht für Werbung.
      </p>

      <H3>Speicherdauer</H3>
      <p>
        Die Einträge werden am Ende des {RETENTION_YEARS}. Kalenderjahres nach der Veranstaltung
        automatisch gelöscht (bei einer Veranstaltung im Jahr 2026 also Ende{" "}
        {2026 + RETENTION_YEARS}). So lange bewahren wir sie auf, weil Fördergeber und
        steuerliche Vorschriften die Listen für diesen Zeitraum als Nachweis verlangen können.
        Ausgedruckte Listen werden zum selben Zeitpunkt vernichtet.
      </p>

      <H2>4. „Daten speichern“ auf Ihrem Gerät</H2>
      <p>
        Nach dem Eintragen können Sie wählen, Ihren Namen, Ihre Staatsangehörigkeit, Universität,
        Ihr Austauschprogramm und Ihren ESNcard-Status in einem Cookie auf Ihrem Gerät zu
        speichern, damit das Formular bei der nächsten Veranstaltung schon ausgefüllt ist. Ihre
        Unterschrift wird dort nie gespeichert. Das Cookie wird nur gesetzt, wenn Sie auf „Save
        my details“ klicken, es bleibt auf Ihrem Gerät (wir speichern es nicht auf unseren
        Servern) und läuft nach 12 Monaten ab.
      </p>
      <p>
        Rechtsgrundlage ist Ihre Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO).
        Sie können sie jederzeit mit Wirkung für die Zukunft widerrufen: über „Not you? Remove
        saved details“ bzw. „Remove them“ im Formular oder indem Sie die Cookies dieser Seite in
        Ihrem Browser löschen.
      </p>

      <H2>5. Anmeldung der Organisator*innen</H2>
      <p>
        Organisator*innen melden sich mit ihrem Google-Workspace-Konto von MESA (@esnmesa.org)
        an, bereitgestellt von {PROCESSORS.login.name}, {PROCESSORS.login.address}. Wir erhalten
        von Google Name, E-Mail-Adresse, Profilbild und Konto-ID. Die App speichert, wer eine
        Veranstaltung angelegt, einen Eintrag auf dem eigenen Gerät aufgenommen, eine Liste
        (mit Unterschrift) abgezeichnet und abgelegt hat. Das Profilbild wird von Servern von
        Google geladen, die dabei die IP-Adresse der Organisatorin bzw. des Organisators
        erhalten. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren Zugang und
        daran, nachvollziehen zu können, wer für eine Liste verantwortlich ist (Art. 6 Abs. 1
        lit. f DSGVO). Diese Daten werden so lange gespeichert wie die zugehörigen
        Veranstaltungen.
      </p>
      <p>
        Bei der Anmeldung werden Cookies gesetzt, die die Sitzung speichern. Sie sind für den
        Bereich der Organisator*innen unbedingt erforderlich und brauchen keine Einwilligung
        (§ 25 Abs. 2 Nr. 2 TDDDG). Teilnehmende erhalten außer dem freiwilligen Cookie aus
        Abschnitt 4 keine Cookies.
      </p>

      <H2>6. Hosting und Server-Logfiles</H2>
      <p>
        Die App wird von {PROCESSORS.hosting.name}, {PROCESSORS.hosting.address}, auf Servern in
        der EU betrieben. Die Daten liegen in einer Datenbank von {PROCESSORS.database.name},{" "}
        {PROCESSORS.database.address}, mit Standort Frankfurt am Main. Beim Aufruf der App
        verarbeiten diese Anbieter automatisch technische Daten: Ihre IP-Adresse, Datum und
        Uhrzeit, die aufgerufene Seite sowie Browser und Betriebssystem. Sie brauchen sie, um
        die App auszuliefern und abzusichern, und speichern sie nur kurz in ihren Logfiles.
        Rechtsgrundlage ist unser berechtigtes Interesse an einem zuverlässigen und sicheren
        Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <H2>7. Dienstleister und Übermittlung in Drittländer</H2>
      <p>
        Vercel, Supabase und Google verarbeiten Daten in unserem Auftrag auf Grundlage von
        Verträgen zur Auftragsverarbeitung (Art. 28 DSGVO). Obwohl die Daten in der EU
        gespeichert sind, können diese Unternehmen oder ihre Unterauftragnehmer aus Ländern
        außerhalb der EU, insbesondere den USA, darauf zugreifen, etwa für Support oder
        Sicherheit. Solche Übermittlungen stützen sich auf das EU-US Data Privacy Framework,
        soweit das Unternehmen danach zertifiziert ist, und im Übrigen auf die
        EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO). Datenschutzhinweise der
        Anbieter: <A href={PROCESSORS.hosting.privacy}>Vercel</A>,{" "}
        <A href={PROCESSORS.database.privacy}>Supabase</A>,{" "}
        <A href={PROCESSORS.login.privacy}>Google</A>.
      </p>

      <H2>8. Kein Tracking</H2>
      <p>
        Die App verwendet keine Analyse-, Tracking- oder Werbewerkzeuge und lädt keine
        Schriften oder Skripte von fremden Seiten. Es findet keine automatisierte
        Entscheidungsfindung statt (Art. 22 DSGVO).
      </p>

      <H2>9. Ihre Rechte</H2>
      <p>Sie haben das Recht auf</p>
      <List>
        <li>Auskunft über Ihre Daten und eine Kopie davon (Art. 15 DSGVO),</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO),</li>
        <li>Löschung (Art. 17 DSGVO),</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO),</li>
        <li>
          Erhalt der von Ihnen bereitgestellten Daten in einem maschinenlesbaren Format (Art. 20
          DSGVO),
        </li>
        <li>Widerruf einer Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</li>
      </List>
      <p className="font-semibold">
        Widerspruchsrecht (Art. 21 DSGVO): Soweit wir Ihre Daten auf Grundlage unseres
        berechtigten Interesses verarbeiten, können Sie aus Gründen, die sich aus Ihrer
        besonderen Situation ergeben, jederzeit widersprechen. Wir verarbeiten sie dann nicht
        mehr, es sei denn, wir können zwingende schutzwürdige Gründe nachweisen oder brauchen
        sie zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.
      </p>
      <p>
        Wenden Sie sich dafür an den Datenschutzbeauftragten unter{" "}
        <A href={`mailto:${DATA_PROTECTION_OFFICER.email}`} /> oder an{" "}
        <A href={`mailto:${ASSOCIATION.email}`} />.
      </p>
      <p>
        Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77
        DSGVO). Für uns zuständig ist das {SUPERVISORY_AUTHORITY.name},{" "}
        {SUPERVISORY_AUTHORITY.address.replace(", Germany", "")},{" "}
        <A href={SUPERVISORY_AUTHORITY.website} />.
      </p>

      <H2>10. Sicherheit</H2>
      <p>
        Alle Verbindungen sind verschlüsselt (HTTPS). Die Einträge sind nur mit einer
        @esnmesa.org-Anmeldung lesbar, was die Datenbank selbst durchsetzt, und Unterschriften
        sind nie öffentlich abrufbar.
      </p>

      <p className="pt-4 text-gray-500">Stand: Oktober 2026</p>
    </LegalPage>
  );
}
