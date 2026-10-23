// Organiser flows: creating events, the live participant list, kiosk mode,
// the sign-off with a headcount, and what organisers, executives and finance
// see once a list is closed.
import {
  EXECUTIVE,
  ORGANISER,
  admin,
  anonClient,
  closeList,
  createEvent,
  deleteEvent,
  participantRow,
} from "../helpers/local";
import { acceptAndSubmit, expect, fillForm, test } from "./fixtures";

test.beforeEach(async ({ signInAsOrganiser }) => {
  await signInAsOrganiser();
});

test("creates an event and lands on its QR code page", async ({ page }) => {
  const title = `E2E event ${Date.now()}`;
  await page.goto("/dashboard/events");
  await expect(page.getByText("Funded events (trips, team building) keep the paper attendance list.")).toBeVisible();
  await page.getByRole("button", { name: "+ New Event" }).click();
  await page.getByPlaceholder("Event title").fill(title);
  await page.locator('input[name="event_date"]').fill("2030-11-05T19:00");
  await page.getByLabel("Risk notice (optional)").fill("Bring warm clothes.");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByRole("heading", { name: "Attendance QR Code" })).toBeVisible();

  const { data } = await admin
    .from("events")
    .select("id, public_token, created_by, risk_notice")
    .eq("title", title)
    .single();
  try {
    await expect(page).toHaveURL(`/dashboard/events/${data!.id}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText(`/event/${data!.public_token}`)).toBeVisible();
    expect(data!.public_token).toMatch(/^[0-9a-f]{32}$/);
    expect(data).toMatchObject({ created_by: ORGANISER.email, risk_notice: "Bring warm clothes." });
    await expect(page.getByText("Responsible: Test Organiser")).toBeVisible();
    // In the future: the QR code is there, sign-ins open 2 hours before
    await expect(page.getByText("Not open yet")).toBeVisible();
    await expect(page.getByText(/^Sign-ins open at /)).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in on this device" })).toHaveCount(0);
  } finally {
    await deleteEvent(data!.id);
  }
});

test("the event page lists sign-ins live, names only", async ({ page, event }) => {
  await anonClient().from("participants").insert(participantRow(event.id, { first_name: "Before" }));

  await page.goto(`/dashboard/events/${event.id}`);
  await expect(page.getByRole("heading", { name: event.title })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Before", exact: true })).toBeVisible();
  await expect(page.getByText(`/event/${event.public_token}`)).toBeVisible();

  // Someone signs in while the page is open
  await anonClient().from("participants").insert(participantRow(event.id, { first_name: "Live" }));
  await expect(page.getByRole("cell", { name: "Live", exact: true })).toBeVisible({ timeout: 15_000 });

  // No per-person details or signatures
  await expect(page.getByRole("columnheader", { name: "Nationality" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Signature" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /signature/ })).toHaveCount(0);
  // The counts follow, the breakdown waits for the closed list
  const summary = page.locator("div.rounded-xl", { has: page.getByRole("heading", { name: "Summary" }) });
  await expect(summary.getByText("Sign-ins").locator("..")).toContainText("2");
  await expect(summary.getByText(/breakdown .* appears once the list is closed/)).toBeVisible();
});

test("kiosk mode records sign-ins under the organiser and starts over", async ({ page, event }) => {
  await page.goto(`/dashboard/events/${event.id}`);
  await page.getByRole("link", { name: "Sign in on this device" }).click();
  await expect(page).toHaveURL(`/kiosk/${event.id}`);
  await expect(page.getByText(`Signed in as ${ORGANISER.email}`)).toBeVisible();
  // Shared device: the browser must not remember earlier participants' names
  await expect(page.locator("form")).toHaveAttribute("autocomplete", "off");
  for (const name of ["first_name", "last_name"]) {
    await expect(page.locator(`input[name="${name}"]`)).toHaveAttribute("autocomplete", "off");
  }

  await fillForm(page, { firstName: "Kiosk", lastName: "Person" });
  await acceptAndSubmit(page);
  await expect(page.getByText("Please hand the device back")).toBeVisible();
  // Shared device: no offer to remember details
  await expect(page.getByText("Save your details for next time?")).toHaveCount(0);

  await page.getByRole("button", { name: "Next person" }).click();
  await expect(page.locator('input[name="first_name"]')).toHaveValue("");

  const { data } = await admin.from("participants").select("*").eq("event_id", event.id);
  expect(data).toHaveLength(1);
  expect(data![0]).toMatchObject({ first_name: "Kiosk", entry_method: "kiosk", recorded_by: ORGANISER.email });
});

test("an unknown event 404s in the kiosk", async ({ page }) => {
  const res = await page.goto(`/kiosk/${crypto.randomUUID()}`);
  expect(res!.status()).toBe(404);
});

test("the creator signs off with a headcount, which closes sign-ins and the names", async ({ page }) => {
  const ev = await createEvent(`Finish ${Date.now()}`, ORGANISER.email);
  try {
    await anonClient().from("participants").insert([
      participantRow(ev.id, { first_name: "Anna", nationality: "DE" }),
      participantRow(ev.id, { first_name: "Ben" }),
    ]);
    await page.goto(`/dashboard/events/${ev.id}`);
    await expect(page.getByText("Open for sign-ins")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Anna", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Finish & sign off" }).click();
    // No number, no sign-off
    await page.getByRole("button", { name: "Sign off & close sign-ins" }).click();
    await expect(page.getByText("Please enter how many people you counted.")).toBeVisible();
    await page.getByLabel("How many people did you count at the event?").fill("3");
    await page.getByRole("button", { name: "Sign off & close sign-ins" }).click();

    await expect(page.getByText("✓ Signed off")).toBeVisible();
    await expect(page.getByText(new RegExp(`^on .* by ${ORGANISER.email}$`))).toBeVisible();
    await expect(page.getByText("Sign-ins are closed – the attendance list was signed off.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in on this device" })).toHaveCount(0);

    // Counts and breakdown for everyone, names no longer for this organiser
    await expect(page.getByText("1 counted person has not signed in.")).toBeVisible();
    await expect(page.getByText("Germany")).toBeVisible();
    await expect(page.getByText("The list is closed: only executives see the names now.")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Anna", exact: true })).toHaveCount(0);

    const { data } = await admin.from("events").select("signed_off_by, headcount").eq("id", ev.id).single();
    expect(data).toEqual({ signed_off_by: ORGANISER.email, headcount: 3 });

    // Both ways to sign in are closed now
    await page.goto(`/event/${ev.public_token}`);
    await expect(page.getByRole("heading", { name: "Sign-ins are closed" })).toBeVisible();
    await page.goto(`/kiosk/${ev.id}`);
    await expect(page.getByRole("heading", { name: "Sign-ins are closed" })).toBeVisible();

    // The list shows the status and the counts
    await page.goto("/dashboard/events");
    await expect(page.getByLabel(`Signed off: ${ev.title}`)).toBeVisible();
    await expect(page.getByText("2 signed in · 3 counted")).toBeVisible();
  } finally {
    await deleteEvent(ev.id);
  }
});

test("only the creator can sign an event off", async ({ page }) => {
  const ev = await createEvent(`Not mine ${Date.now()}`, "someone-else@esnmesa.org");
  try {
    await page.goto(`/dashboard/events/${ev.id}`);
    await expect(page.getByText("Only someone-else@esnmesa.org can sign this event off.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish & sign off" })).toHaveCount(0);
  } finally {
    await deleteEvent(ev.id);
  }
});

test("a list closed 24 hours after the event awaits the sign-off", async ({ page, event }) => {
  await anonClient().from("participants").insert(participantRow(event.id, { first_name: "Late" }));
  await closeList(event.id);
  await page.goto(`/dashboard/events/${event.id}`);
  await expect(page.getByText("Closed – awaiting sign-off")).toBeVisible();
  await expect(page.getByText("Sign-ins are closed – the event ended more than 24 hours ago.")).toBeVisible();
  await expect(page.getByText("The list is closed: only executives see the names now.")).toBeVisible();
  await page.goto("/dashboard/events");
  await expect(page.getByLabel(`Awaiting sign-off: ${event.title}`)).toBeVisible();
});

test("executives still see the names of a closed list", async ({ page, context, event, signInAsOrganiser }) => {
  await anonClient().from("participants").insert(participantRow(event.id, { first_name: "Kept" }));
  await closeList(event.id);
  await context.clearCookies();
  await signInAsOrganiser(EXECUTIVE);
  await page.goto(`/dashboard/events/${event.id}`);
  await expect(page.getByRole("cell", { name: "Kept", exact: true })).toBeVisible();
  await expect(page.getByText("Visible to you as an executive")).toBeVisible();
  await expect(page.getByRole("banner").getByText("Executive", { exact: true })).toBeVisible();
});

test("finance gets a link to the event page", async ({ page, context, event }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/dashboard/events/${event.id}`);
  await page.getByRole("button", { name: "Copy link for finance" }).click();
  await expect(page.getByRole("button", { name: "✓ Link copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});

test("lists your own events first, then everyone else's", async ({ page, event }) => {
  // `event` was made by the service role: no creator.
  const mine = await createEvent(`Mine ${Date.now()}`, ORGANISER.email);
  const theirs = await createEvent(`Theirs ${Date.now()}`, "someone-else@esnmesa.org");
  try {
    await page.goto("/dashboard/events");
    const yours = page.getByRole("region", { name: "Your events" });
    const all = page.getByRole("region", { name: "All events" });
    await expect(yours.getByText(mine.title)).toBeVisible();
    await expect(all.getByText(theirs.title)).toBeVisible();
    await expect(all.getByText(event.title)).toBeVisible();
    // Each event appears once.
    await expect(all.getByText(mine.title)).toHaveCount(0);
    await expect(yours.getByText(theirs.title)).toHaveCount(0);
    await expect(yours.getByText(event.title)).toHaveCount(0);
    // No exports or filing any more
    await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(0);
    await expect(page.getByText("Only lists not yet filed in the office")).toHaveCount(0);
  } finally {
    await deleteEvent(mine.id);
    await deleteEvent(theirs.id);
  }
});

test("events are sorted by date, newest first", async ({ page }) => {
  const stamp = Date.now();
  const at = (d: string) => ({ event_date: d });
  const made = [
    await createEvent(`Sort B ${stamp}`, ORGANISER.email, at("2031-03-01T18:00:00Z")),
    await createEvent(`Sort C ${stamp}`, ORGANISER.email, at("2031-01-01T18:00:00Z")),
    await createEvent(`Sort A ${stamp}`, ORGANISER.email, at("2031-05-01T18:00:00Z")),
  ];
  try {
    await page.goto("/dashboard/events");
    const titles = page.getByRole("region", { name: "Your events" }).getByText(new RegExp(`^Sort . ${stamp}$`));
    await expect(titles).toHaveText([`Sort A ${stamp}`, `Sort B ${stamp}`, `Sort C ${stamp}`]);
  } finally {
    for (const e of made) await deleteEvent(e.id);
  }
});

test.describe("in Munich", () => {
  test.use({ timezoneId: "Europe/Berlin" });

  test("stores the entered time in the organiser's time zone", async ({ page }) => {
    const title = `TZ event ${Date.now()}`;
    await page.goto("/dashboard/events");
    await page.getByRole("button", { name: "+ New Event" }).click();
    await page.getByPlaceholder("Event title").fill(title);
    // Pre-filled with the current local time
    const now = await page.evaluate(() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    });
    const prefilled = await page.locator('input[name="event_date"]').inputValue();
    expect(Math.abs(new Date(prefilled).getTime() - new Date(now).getTime())).toBeLessThanOrEqual(60_000);
    await page.locator('input[name="event_date"]').fill("2030-11-05T19:00");
    await page.getByRole("button", { name: "Create Event" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("05 November 2030 at 19:00")).toBeVisible();

    const { data } = await admin.from("events").select("id, event_date").eq("title", title).single();
    await admin.from("events").delete().eq("id", data!.id);
    // 19:00 in Munich (CET) is 18:00 UTC
    expect(new Date(data!.event_date).toISOString()).toBe("2030-11-05T18:00:00.000Z");
  });

  test("edits an event in place: same id and QR code, fixed details", async ({ page, event }) => {
    await page.goto(`/dashboard/events/${event.id}`);
    await page.getByRole("button", { name: "Edit" }).click();
    // Pre-filled with the current values
    await expect(page.getByPlaceholder("Event title")).toHaveValue(event.title);

    // Cancel changes nothing
    await page.getByPlaceholder("Event title").fill("Discarded");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: event.title })).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByPlaceholder("Event title").fill("Stammtisch (typo fixed)");
    await page.locator('input[name="event_date"]').fill("2030-12-01T20:30");
    await page.getByLabel("Risk notice (optional)").fill("Stairs only.");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("heading", { name: "Stammtisch (typo fixed)" })).toBeVisible();
    await expect(page.getByText("01 December 2030 at 20:30")).toBeVisible();
    await expect(page.getByText("Stairs only.")).toBeVisible();
    await expect(page.getByText("Responsible: Rita Responsible", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`/dashboard/events/${event.id}`);
    await expect(page.getByText(`/event/${event.public_token}`)).toBeVisible();

    const { data } = await admin.from("events").select("*").eq("id", event.id).single();
    expect(data).toMatchObject({
      public_token: event.public_token,
      title: "Stammtisch (typo fixed)",
      responsible_member: "Rita Responsible",
      risk_notice: "Stairs only.",
    });
    expect(new Date(data!.event_date).toISOString()).toBe("2030-12-01T19:30:00.000Z");
  });

  test("once people signed in, only the title can change", async ({ page, event }) => {
    await anonClient().from("participants").insert(participantRow(event.id));
    await page.goto(`/dashboard/events/${event.id}`);
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.locator('input[name="event_date"]')).not.toBeEditable();
    await expect(page.getByLabel("Risk notice (optional)")).not.toBeEditable();
    await expect(page.getByText("People have signed in already")).toBeVisible();
    await page.getByPlaceholder("Event title").fill("Renamed after sign-ins");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Renamed after sign-ins" })).toBeVisible();
  });
});

test("the logo leads back to the events page; no separate Events link", async ({ page, event }) => {
  await page.goto(`/dashboard/events/${event.id}`);
  await expect(page.getByRole("banner").getByRole("link", { name: "Events", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "ESN MESA München – back to events" }).click();
  await expect(page).toHaveURL("/dashboard/events");
});
