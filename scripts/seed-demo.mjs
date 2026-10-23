// `npm run seed:demo` – demo events and participants in the LOCAL database,
// to click through the app. Run it again to start over: it replaces only
// the events it created before. Never touches the project in .env.local.
import { createClient } from "@supabase/supabase-js";
import { LOCAL_ENV } from "./local-supabase.mjs";

const ORGANISER = "organiser@esnmesa.org"; // from supabase/seed.sql
// Demo events are recognised by their QR code token.
const DEMO_TOKEN = "demo";

const db = createClient(LOCAL_ENV.NEXT_PUBLIC_SUPABASE_URL, LOCAL_ENV.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const hours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
const token = () => DEMO_TOKEN + crypto.randomUUID().replace(/-/g, "").slice(DEMO_TOKEN.length);

// The app takes the responsible member from the creator's Google account.
const mine = { created_by: ORGANISER, responsible_member: "Test Organiser" };

// One of each state: open now (yours, with a risk notice), upcoming (yours),
// signed off (yours), closed but not signed off (someone else's).
const events = [
  { title: "Hike to the Kampenwand", event_date: hours(0), ...mine,
    risk_notice: "Mountain hike, 4 hours, steep and possibly muddy paths. Bring hiking boots, water and a rain jacket." },
  { title: "Stammtisch November", event_date: hours(24 * 5), ...mine },
  { title: "Pub Crawl Maxvorstadt", event_date: hours(-24 * 7), ...mine, signoff: 7 },
  { title: "Welcome Brunch", event_date: hours(-24 * 3), created_by: "someone-else@esnmesa.org",
    responsible_member: "Someone Else" },
];

const people = [
  ["Giulia", "Rossi", "IT", "LMU", "Erasmus+", true],
  ["Lucas", "Martin", "FR", "TUM", "Erasmus+", false],
  ["Maximiliane-Theresa", "Wolfeschlegelsteinhausen", "GB", "Other", "Full-time degree", false],
  ["Ana", "García", "ES", "LMU", "LMUexchange", true],
  ["Mehmet", "Yılmaz", null, null, null, null],
];

async function main() {
  const old = await db.from("events").delete().like("public_token", `${DEMO_TOKEN}%`).select("id");
  if (old.error) throw old.error;

  for (const { signoff, ...e } of events) {
    const { data: event, error } = await db
      .from("events")
      .insert({ public_token: token(), ...e })
      .select("id, title, public_token")
      .single();
    if (error) throw error;

    // Participants for all but the upcoming event.
    if (new Date(e.event_date).getTime() < Date.now() + 3_600_000) {
      const rows = people.map(([first_name, last_name, nationality, university, exchange_program, esn_card]) => ({
        event_id: event.id, first_name, last_name, nationality, university, exchange_program, esn_card,
        notice_version: "2026-10-23", terms_version: "2026-10-23", entry_method: "self", recorded_by: null,
      }));
      rows.push({ ...rows[0], first_name: "Kim", last_name: "Kiosk", entry_method: "kiosk", recorded_by: ORGANISER });
      const { error: pErr } = await db.from("participants").insert(rows);
      if (pErr) throw pErr;
    }

    // As the app would on a sign-off: count, record, clear the optional details.
    if (signoff) {
      const { data: stats } = await db.rpc("compute_event_stats", { event: event.id });
      await db.from("events").update({ signed_off_at: hours(-24 * 6), signed_off_by: ORGANISER, headcount: signoff, stats }).eq("id", event.id);
      await db.rpc("clear_participant_details", { event: event.id });
    }
    console.log(`  ${event.title.padEnd(24)} form: http://localhost:3000/event/${event.public_token}`);
  }
  // The closed-but-not-signed-off event gets counted like the hourly job does.
  await db.rpc("close_expired_lists");
  console.log(`Replaced ${old.data.length} demo events with ${events.length}.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  console.error("Is the local stack running? npm run supabase:start");
  process.exit(1);
});
