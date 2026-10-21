// Organiser flows: creating events, the live participant list, kiosk mode
// and the exports.
import { ORGANISER, admin, anonClient, participantRow } from "../helpers/local";
import { sampleSignature } from "../helpers/png";
import { acceptAndSubmit, drawSignature, expect, fillForm, test } from "./fixtures";

test.beforeEach(async ({ signInAsOrganiser }) => {
  await signInAsOrganiser();
});

test("creates an event with a 32-character QR code token", async ({ page }) => {
  const title = `E2E event ${Date.now()}`;
  await page.goto("/dashboard/events");
  await page.getByRole("button", { name: "+ New Event" }).click();
  await page.getByPlaceholder("Event title").fill(title);
  await page.locator('input[name="event_date"]').fill("2026-11-05T19:00");
  await page.getByPlaceholder("Name of responsible MESA member").fill("Rita Responsible");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText(title)).toBeVisible();

  const { data } = await admin.from("events").select("id, public_token").eq("title", title).single();
  try {
    expect(data!.public_token).toMatch(/^[0-9a-f]{32}$/);
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

  const img = page.getByAltText("Live Mustermann signature");
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
