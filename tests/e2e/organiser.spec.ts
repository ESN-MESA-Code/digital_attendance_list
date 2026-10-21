// Organiser flows: creating events, the live participant list, kiosk mode
// and the exports.
import { PDFDocument } from "pdf-lib";
import { ORGANISER, admin, anonClient, createEvent, deleteEvent, participantRow, signOffEvent } from "../helpers/local";
import { sampleSignature } from "../helpers/png";
import { acceptSignAndSubmit, drawSignature, expect, fillForm, test } from "./fixtures";

test.beforeEach(async ({ signInAsOrganiser }) => {
  await signInAsOrganiser();
});

test("creates an event and lands on its QR code page", async ({ page }) => {
  const title = `E2E event ${Date.now()}`;
  await page.goto("/dashboard/events");
  await page.getByRole("button", { name: "+ New Event" }).click();
  await page.getByPlaceholder("Event title").fill(title);
  await page.locator('input[name="event_date"]').fill("2026-11-05T19:00");
  await page.getByPlaceholder("Name of responsible MESA member").fill("Rita Responsible");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByRole("heading", { name: "Attendance QR Code" })).toBeVisible();

  const { data } = await admin.from("events").select("id, public_token, created_by").eq("title", title).single();
  try {
    await expect(page).toHaveURL(`/dashboard/events/${data!.id}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText(`/event/${data!.public_token}`)).toBeVisible();
    expect(data!.public_token).toMatch(/^[0-9a-f]{32}$/);
    expect(data!.created_by).toBe(ORGANISER.email);
  } finally {
    await admin.from("events").delete().eq("id", data!.id);
  }
});

test("the event page lists sign-ins live, with signatures", async ({ page, event }) => {
  const signature = await sampleSignature();
  await anonClient().from("participants").insert(participantRow(event.id, signature, { first_name: "Before" }));

  await page.goto(`/dashboard/events/${event.id}`);
  await expect(page.getByRole("heading", { name: event.title })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Before", exact: true })).toBeVisible();
  await expect(page.getByText(`/event/${event.public_token}`)).toBeVisible();

  // Someone signs in while the page is open
  await anonClient().from("participants").insert(participantRow(event.id, signature, { first_name: "Live" }));
  await expect(page.getByRole("cell", { name: "Live", exact: true })).toBeVisible({ timeout: 15_000 });

  // (The phone cards hold a hidden copy of each signature.)
  const img = page.getByAltText("Live Mustermann signature").filter({ visible: true });
  await expect(img).toHaveAttribute("src", signature);
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
});

test("kiosk mode records sign-ins under the organiser and starts over", async ({ page, event }) => {
  await page.goto(`/dashboard/events/${event.id}`);
  await page.getByRole("link", { name: "Sign in on this device" }).click();
  await expect(page).toHaveURL(`/kiosk/${event.id}`);
  await expect(page.getByText(`Signed in as ${ORGANISER.email}`)).toBeVisible();

  await fillForm(page, { firstName: "Kiosk", lastName: "Person" });
  await acceptSignAndSubmit(page);
  await expect(page.getByText("Please hand the device back")).toBeVisible();
  // Shared device: no offer to remember details
  await expect(page.getByText("Save your details for next time?")).toHaveCount(0);

  await page.getByRole("button", { name: "Next person" }).click();
  await expect(page.locator('input[name="first_name"]')).toHaveValue("");

  const { data } = await admin.from("participants").select("*").eq("event_id", event.id);
  expect(data).toHaveLength(1);
  expect(data![0]).toMatchObject({ first_name: "Kiosk", entry_method: "kiosk", recorded_by: ORGANISER.email });
  expect(data![0].signature).toMatch(/^data:image\/png;base64,/);
});

test("exports CSV without signatures and PDF with them", async ({ page, event }) => {
  const signature = await sampleSignature();
  await anonClient().from("participants").insert([
    participantRow(event.id, signature, { first_name: "=HYPERLINK(\"http://evil\")", last_name: "Doe, Jane" }),
    participantRow(event.id, signature, { first_name: "Zoë", nationality: "DE" }),
  ]);

  await page.goto(`/dashboard/events/${event.id}`);
  await expect(page.getByRole("link", { name: "Download as CSV" })).toHaveAttribute("href", `/api/export/event/${event.id}/csv`);
  // The PDF waits for the sign-off
  await expect(page.getByRole("link", { name: "Download as PDF" })).toHaveAttribute("aria-disabled", "true");
  // Country names are always exported in English.
  await expect(page.getByRole("combobox")).toHaveCount(0);

  const csv = await page.request.get(`/api/export/event/${event.id}/csv`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  const [header, ...lines] = text.split("\r\n");
  expect(header).toBe(
    "Surname,First Name,Nationality,University,Exchange Programme,ESNcard,Registered At,Entry Method,Recorded By"
  );
  expect(lines).toHaveLength(2);
  expect(text).not.toContain("data:image");
  expect(text).toContain('"Doe, Jane"');
  expect(text).toContain("Germany");
  // Security: the formula is neutralised for spreadsheet apps
  expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`);

  expect(text).not.toContain("Deutschland");

  // The PDF is the signed list: refused until the event is signed off
  expect((await page.request.get(`/api/export/event/${event.id}/pdf`)).status()).toBe(409);
  await signOffEvent(event.id, signature);
  const pdf = await page.request.get(`/api/export/event/${event.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
});

test("an unknown event 404s in exports and the kiosk", async ({ page }) => {
  const id = crypto.randomUUID();
  expect((await page.request.get(`/api/export/event/${id}/csv`)).status()).toBe(404);
  expect((await page.request.get(`/api/export/event/${id}/pdf`)).status()).toBe(404);
  const res = await page.goto(`/kiosk/${id}`);
  expect(res!.status()).toBe(404);
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
  } finally {
    await deleteEvent(mine.id);
    await deleteEvent(theirs.id);
  }
});

test("exports several events as one PDF and marks them as filed", async ({ page, event }) => {
  const second = await createEvent(`Second ${Date.now()}`, ORGANISER.email);
  try {
    const signature = await sampleSignature();
    await anonClient().from("participants").insert([
      participantRow(event.id, signature),
      participantRow(second.id, signature, { first_name: "Zoë" }),
    ]);
    const unsigned = await createEvent(`Unsigned ${Date.now()}`, ORGANISER.email);
    await signOffEvent(event.id, signature);
    await signOffEvent(second.id, signature);

    await page.goto("/dashboard/events");
    // No checkboxes until you start an export
    await expect(page.getByRole("checkbox", { name: `Select ${event.title}` })).toHaveCount(0);
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(page.getByText("Select the signed-off events to export")).toBeVisible();
    await expect(page.getByRole("link", { name: /Download PDF/ })).toHaveCount(0);

    // Only signed-off events can be picked
    await expect(page.getByRole("checkbox", { name: `Select ${unsigned.title}` })).toBeDisabled();
    await deleteEvent(unsigned.id);
    await page.getByRole("checkbox", { name: `Select ${event.title}` }).check();
    await page.getByRole("checkbox", { name: `Select ${second.title}` }).check();
    await expect(page.getByText("2 selected")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download PDF (2)" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("attendance_2_events.pdf");
    const url = new URL(download.url());
    expect(url.pathname).toBe("/api/export/events/pdf");

    const res = await page.request.get(url.pathname + url.search);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    const doc = await PDFDocument.load(await res.body());
    // One page per event (few participants each).
    expect(doc.getPageCount()).toBe(2);

    // Offered to mark the printed lists as filed
    await page.getByRole("button", { name: "✓ Mark as filed" }).click();
    await expect(page.getByRole("button", { name: `Filed: ${event.title}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Filed: ${second.title}` })).toBeVisible();
    const { data } = await admin.from("events").select("filed_at, filed_by").in("id", [event.id, second.id]);
    expect(data).toHaveLength(2);
    for (const row of data!) {
      expect(row.filed_at).not.toBeNull();
      expect(row.filed_by).toBe(ORGANISER.email);
    }
    await expect(page.getByRole("checkbox", { name: `Select ${event.title}` })).toHaveCount(0);
  } finally {
    await deleteEvent(second.id);
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

test("tracks which printed lists are filed in the office", async ({ page, event }) => {
  await page.goto("/dashboard/events");
  const chip = page.getByRole("button", { name: `Not filed: ${event.title}` });
  // Only after the sign-off
  await expect(chip).toBeDisabled();
  await signOffEvent(event.id, await sampleSignature());
  await page.reload();
  await chip.click();
  await expect(page.getByRole("button", { name: `Filed: ${event.title}` })).toBeVisible();

  // "Only not yet filed" hides it
  await page.getByLabel("Only lists not yet filed in the office").check();
  await expect(page.getByText(event.title)).toHaveCount(0);
  await page.getByLabel("Only lists not yet filed in the office").uncheck();

  // The event page shows who filed it, and can undo
  await page.goto(`/dashboard/events/${event.id}`);
  await expect(page.getByText(/^on .* by organiser@esnmesa\.org$/)).toHaveCount(2); // signed off and filed
  await expect(page.getByText("✓ Filed in office")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Not filed yet")).toBeVisible();
  await page.getByRole("button", { name: "✓ Mark as filed" }).click();
  await expect(page.getByText(/^on \d\d \w+ \d{4} by /)).toHaveCount(2); // signed off and filed again

  const { data } = await admin.from("events").select("filed_by").eq("id", event.id).single();
  expect(data!.filed_by).toBe(ORGANISER.email);
});

test("the combined export checks its ids", async ({ page, event }) => {
  const get = (ids: string) => page.request.get(`/api/export/events/pdf?ids=${ids}`);
  expect((await get("")).status()).toBe(400);
  expect((await get("not-a-uuid")).status()).toBe(400);
  expect((await get(`${event.id},1;drop`)).status()).toBe(400);
  const tooMany = Array.from({ length: 51 }, () => crypto.randomUUID()).join(",");
  expect((await get(tooMany)).status()).toBe(400);
  expect((await get(`${event.id},${crypto.randomUUID()}`)).status()).toBe(404);
  // Not signed off yet
  expect((await get(event.id)).status()).toBe(409);
  await signOffEvent(event.id, await sampleSignature());
  expect((await get(event.id)).status()).toBe(200);
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
    await page.locator('input[name="event_date"]').fill("2026-11-05T19:00");
    await page.getByRole("button", { name: "Create Event" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("05 November 2026 at 19:00")).toBeVisible();

    const { data } = await admin.from("events").select("id, event_date").eq("title", title).single();
    await admin.from("events").delete().eq("id", data!.id);
    // 19:00 in Munich (CET) is 18:00 UTC
    expect(new Date(data!.event_date).toISOString()).toBe("2026-11-05T18:00:00.000Z");
  });

  test("edits an event in place: same id and QR code, fixed details", async ({ page, event }) => {
    await page.goto(`/dashboard/events/${event.id}`);
    await page.getByRole("button", { name: "Edit" }).click();
    // Pre-filled with the current values
    await expect(page.getByPlaceholder("Event title")).toHaveValue(event.title);
    await expect(page.getByPlaceholder("Name of LEI responsible person")).toHaveValue("Lea LEI");

    // Cancel changes nothing
    await page.getByPlaceholder("Event title").fill("Discarded");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: event.title })).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByPlaceholder("Event title").fill("Stammtisch (typo fixed)");
    await page.getByPlaceholder("Event description").fill("New description");
    await page.locator('input[name="event_date"]').fill("2026-12-01T20:30");
    await page.getByPlaceholder("Name of responsible MESA member").fill("Rita Fixed");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("heading", { name: "Stammtisch (typo fixed)" })).toBeVisible();
    await expect(page.getByText("New description")).toBeVisible();
    await expect(page.getByText("01 December 2026 at 20:30")).toBeVisible();
    await expect(page.getByText("Responsible: Rita Fixed · LEI: Lea LEI")).toBeVisible();
    await expect(page).toHaveURL(`/dashboard/events/${event.id}`);
    await expect(page.getByText(`/event/${event.public_token}`)).toBeVisible();

    const { data } = await admin.from("events").select("*").eq("id", event.id).single();
    expect(data).toMatchObject({
      public_token: event.public_token,
      title: "Stammtisch (typo fixed)",
      description: "New description",
      responsible_member: "Rita Fixed",
      lei_responsible: "Lea LEI",
    });
    expect(new Date(data!.event_date).toISOString()).toBe("2026-12-01T19:30:00.000Z");

    // The participant form shows the fixed title
    await page.goto(`/event/${event.public_token}`);
    await expect(page.getByRole("heading", { name: "Stammtisch (typo fixed)" })).toBeVisible();
  });
});

test("the logo leads back to the events page; no separate Events link", async ({ page, event }) => {
  await page.goto(`/dashboard/events/${event.id}`);
  await expect(page.getByRole("banner").getByRole("link", { name: "Events", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "ESN MESA München – back to events" }).click();
  await expect(page).toHaveURL("/dashboard/events");
});

test("the creator finishes the event with a signature, which closes sign-ins", async ({ page }) => {
  const ev = await createEvent(`Finish ${Date.now()}`, ORGANISER.email);
  try {
    await page.goto(`/dashboard/events/${ev.id}`);
    await expect(page.getByText("Open for sign-ins")).toBeVisible();
    await expect(page.getByText("Can be filed after the sign-off.")).toBeVisible();
    // No PDF before the sign-off
    await expect(page.getByRole("link", { name: "Download as PDF" })).toHaveAttribute("aria-disabled", "true");

    await page.getByRole("button", { name: "Finish & sign" }).click();
    // An empty pad is not a signature
    await page.getByRole("button", { name: "Sign off & close sign-ins" }).click();
    await expect(page.getByText("Please sign first.")).toBeVisible();
    await drawSignature(page);
    await page.getByRole("button", { name: "Sign off & close sign-ins" }).click();

    await expect(page.getByText("✓ Signed off")).toBeVisible();
    await expect(page.getByText(new RegExp(`^on .* by ${ORGANISER.email}$`))).toBeVisible();
    await expect(page.getByText("Sign-ins are closed – the attendance list was signed off.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in on this device" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Download as PDF" })).toHaveAttribute(
      "href",
      `/api/export/event/${ev.id}/pdf`
    );
    expect((await page.request.get(`/api/export/event/${ev.id}/pdf`)).status()).toBe(200);

    const { data } = await admin.from("events").select("signed_off_by, organiser_signature").eq("id", ev.id).single();
    expect(data!.signed_off_by).toBe(ORGANISER.email);
    expect(data!.organiser_signature).toMatch(/^data:image\/png;base64,/);

    // Both ways to sign in are closed now
    await page.goto(`/event/${ev.public_token}`);
    await expect(page.getByRole("heading", { name: "Sign-ins are closed" })).toBeVisible();
    await page.goto(`/kiosk/${ev.id}`);
    await expect(page.getByRole("heading", { name: "Sign-ins are closed" })).toBeVisible();

    // The list shows the status
    await page.goto("/dashboard/events");
    await expect(page.getByLabel(`Signed off: ${ev.title}`)).toBeVisible();
  } finally {
    await deleteEvent(ev.id);
  }
});

test("only the creator can sign an event off", async ({ page }) => {
  const ev = await createEvent(`Not mine ${Date.now()}`, "someone-else@esnmesa.org");
  try {
    await page.goto(`/dashboard/events/${ev.id}`);
    await expect(page.getByText("Only someone-else@esnmesa.org can sign this event off.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish & sign" })).toHaveCount(0);
  } finally {
    await deleteEvent(ev.id);
  }
});
