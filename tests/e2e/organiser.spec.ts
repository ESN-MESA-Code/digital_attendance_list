// Organiser flows: creating events, the live participant list, kiosk mode
// and the exports.
import { PDFDocument } from "pdf-lib";
import { ORGANISER, admin, anonClient, createEvent, deleteEvent, participantRow } from "../helpers/local";
import { sampleSignature } from "../helpers/png";
import { acceptAndSubmit, drawSignature, expect, fillForm, test } from "./fixtures";

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
  await drawSignature(page);
  await acceptAndSubmit(page);
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

  const csv = await page.request.get(`/api/export/event/${event.id}/csv?lang=en`);
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

  const de = await page.request.get(`/api/export/event/${event.id}/csv`);
  expect(await de.text()).toContain("Deutschland");

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

test("exports several selected events as one PDF", async ({ page, event }) => {
  const second = await createEvent(`Second ${Date.now()}`, ORGANISER.email);
  try {
    const signature = await sampleSignature();
    await anonClient().from("participants").insert([
      participantRow(event.id, signature),
      participantRow(second.id, signature, { first_name: "Zoë" }),
    ]);

    await page.goto("/dashboard/events");
    await expect(page.getByRole("link", { name: "Export PDF" })).toHaveCount(0);
    await page.getByRole("checkbox", { name: `Select ${event.title}` }).check();
    await page.getByRole("checkbox", { name: `Select ${second.title}` }).check();
    await expect(page.getByText("2 selected")).toBeVisible();
    await page.getByRole("combobox").selectOption("en");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Export PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("attendance_2_events.pdf");
    const url = new URL(download.url());
    expect(url.pathname).toBe("/api/export/events/pdf");
    expect(url.searchParams.get("lang")).toBe("en");

    const res = await page.request.get(url.pathname + url.search);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    const doc = await PDFDocument.load(await res.body());
    // One page per event (few participants each).
    expect(doc.getPageCount()).toBe(2);
  } finally {
    await deleteEvent(second.id);
  }
});

test("the combined export checks its ids", async ({ page, event }) => {
  const get = (ids: string) => page.request.get(`/api/export/events/pdf?ids=${ids}`);
  expect((await get("")).status()).toBe(400);
  expect((await get("not-a-uuid")).status()).toBe(400);
  expect((await get(`${event.id},1;drop`)).status()).toBe(400);
  const tooMany = Array.from({ length: 51 }, () => crypto.randomUUID()).join(",");
  expect((await get(tooMany)).status()).toBe(400);
  expect((await get(`${event.id},${crypto.randomUUID()}`)).status()).toBe(404);
  expect((await get(event.id)).status()).toBe(200);
});
