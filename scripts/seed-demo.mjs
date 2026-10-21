// `npm run seed:demo` – demo events and participants in the LOCAL database,
// to click through the app. Run it again to start over: it replaces only
// the events it created before. Never touches the project in .env.local.
import { createClient } from "@supabase/supabase-js";
import { LOCAL_ENV } from "./local-supabase.mjs";

const DEMO = "Demo data (npm run seed:demo)";
const ORGANISER = "organiser@esnmesa.org"; // from supabase/seed.sql
// A real signature as the app stores it: a small 2-bit greyscale PNG.
const SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAABLAgAAAAAhg01ZAAADyUlEQVR4nOWXO3LbMBCGV1bBQgX7NLpAPDoCNeMix8kRxMQHyhGEWBfgEdinQcGCmYBE9gHinYktV5mw8IhLfMA+fgBrsO944L+Cl+Yd8AjvgHvo7odhOt4Nm/3S3g3PrW3uhnVrb6+Cv1VsY2eH18B6VzGqzurXwIqLkhuvVl/q8M/P0QtAW444Y8K7Oqwewm8Dw74cgaGYUxVeAS7+ZW7mh3IEzre2VXgGOPoX3a7lEEPOHKqw3quDfxlPtsyYIYU8VWHV6hCmulh1zEfMlMPnKnzuTAizx8WLdGuyfK/CYKMwMa+6KWDyRdXgBZeF6/aGAcxFrTAR+KcGz7hQ37kXKoopxij6jBKLPvRHH5A6OZs5UN2vKSvw1EWwAUkT7piQI8N7vktZ29NsKLEAj05YWBxJJz0TueD92B5w8wZY7URYZ2K2BGtadMhrxdASw3AaWVjkvE8ww5rti1f8ylt8bQKMaWFtsPS8SgaKbuKpBtjcMTL1PsBmJ+6w9JbNrLZPGM5l90eYpqcS6JOPaoN5KnRmcH67oL4EmBLMJeYRW2m/Sjou/E27rLt0qgCrVvzp+W2TmKzRn9gr04Z1KAkBpgG0J2S4SmCaGH1ZmwTWAWYZqdMsH5wuVjkVcH9znK4G43FjrPOFo9SNW9Lp0zmKW4M1ICHZofOwTC7FWQASzxy8wAdgnV6TmBD+JMPEpcF5JKLi85WeM7BjY5fDNxmW7ngRlZ3dsEF2nKvV+eLhF1kqPWucDrSDZ9kzLpshyXSQ2WgT2tgRfXXvP8RawIM4lsKL6Fjb1Mrurf7eBDfAJ8HbecrUKJoJ6QHnWh1+yeBdDk+M+Qy658xT3jKYVTJHsOnCStEwtj5lVt5yk7/JQIRQXIUSRn5XsDBDYUDyb/LOY2A9HDIrqySGV4bzK4VHrPmxydZNwhwrTT/lDvKw5ZhZWWKhMCDF0/kanBXTZVZ20F9kBFNKizt4bmownzPh6gI55Ib8RuE1pktmZZVE94Qcr7nABPb7Ih6+JjAJ+Fw4SGuMOUsqiXoOsNII1taQIz+Fu7iqwDu+0muRuPN9wQfnlMDY8Zuyy6MsPBdWPNt0kB3w+VAITODSijtKhaoC9x06F7F0PGW/iy5GfQJw5cs+jTRnSive4lGHQpnalV0HZgLhY2G18DHKLf3sr0WZWSVTacXGP9q8BA+PlSYSG8Ht1I4fDdH+AzaUlaIv7mpKHYp6cWlDoGhNLamkr1jdyRhgC2W+MLrHyj8XuXP4/Kp90VAWvwZXnzmO7q1wEt2b4b8//yj8GyWrCkr5qaENAAAAAElFTkSuQmCC";

const db = createClient(LOCAL_ENV.NEXT_PUBLIC_SUPABASE_URL, LOCAL_ENV.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const day = (d) => new Date(Date.now() + d * 86_400_000).toISOString();
const token = () => crypto.randomUUID().replace(/-/g, "");

// The app takes the responsible member from the creator's Google account.
const mine = { created_by: ORGANISER, responsible_member: "Test Organiser" };
const signedOff = (by, d) => ({ signed_off_at: day(d), signed_off_by: by, organiser_signature: SIGNATURE });

// One of each state: open (yours), signed off (yours), signed off and filed
// (someone else's), and an older event without a creator.
const events = [
  { title: "Stammtisch Oktober", event_date: day(2), ...mine },
  { title: "Pub Crawl Maxvorstadt", event_date: day(-7), ...mine, ...signedOff(ORGANISER, -6) },
  { title: "Welcome Brunch", event_date: day(-14), created_by: "someone-else@esnmesa.org",
    responsible_member: "Someone Else", ...signedOff("someone-else@esnmesa.org", -13),
    filed_at: day(-10), filed_by: "someone-else@esnmesa.org" },
  { title: "Museum Night", event_date: day(-30), created_by: null, responsible_member: "Old Organiser" },
];

const people = [
  ["Giulia", "Rossi", "IT", "LMU", "Erasmus+", true],
  ["Lucas", "Martin", "FR", "TUM", "Erasmus+", false],
  ["Maximiliane-Theresa", "Wolfeschlegelsteinhausen", "GB", "Other", "Full-time degree", false],
  ["Ana", "García", "ES", "LMU", "LMUexchange", true],
  ["Mehmet", "Yılmaz", "TR", "TUM", "Other", false],
];

async function main() {
  const old = await db.from("events").delete().eq("description", DEMO).select("id");
  if (old.error) throw old.error;

  const { data: created, error } = await db
    .from("events")
    .insert(events.map((e) => ({ description: DEMO, public_token: token(), ...e })))
    .select("id, title, public_token");
  if (error) throw error;

  // Participants for all but the last event (an empty list prints as a blank form).
  for (const event of created.slice(0, -1)) {
    const rows = people.map(([first_name, last_name, nationality, university, exchange_program, esn_card]) => ({
      event_id: event.id, first_name, last_name, nationality, university, exchange_program, esn_card,
      signature: SIGNATURE, entry_method: "self", recorded_by: null,
    }));
    rows.push({ ...rows[0], first_name: "Kim", last_name: "Kiosk", entry_method: "kiosk", recorded_by: ORGANISER });
    const { error: pErr } = await db.from("participants").insert(rows);
    if (pErr) throw pErr;
  }

  console.log(`Replaced ${old.data.length} demo events with ${created.length}:`);
  for (const e of created) console.log(`  ${e.title.padEnd(24)} form: http://localhost:3000/event/${e.public_token}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  console.error("Is the local stack running? npm run supabase:start");
  process.exit(1);
});
