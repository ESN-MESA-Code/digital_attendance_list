// The public attendance form participants open from the QR code.
import { admin } from "../helpers/local";
import { decodeGreyPng } from "../helpers/png";
import { acceptAndSubmit, drawSignature, expect, fillForm, test } from "./fixtures";

async function rowsFor(eventId: string) {
  const { data } = await admin.from("participants").select("*").eq("event_id", eventId);
  return data ?? [];
}

test("signs in with a small signature stored in the database", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await expect(page.getByRole("heading", { name: event.title })).toBeVisible();

  await fillForm(page, { firstName: "Erika", lastName: "Mustermann" });
  await drawSignature(page);
  await acceptAndSubmit(page);
  await expect(page.getByText("Thank you!")).toBeVisible();

  const [row] = await rowsFor(event.id);
  expect(row).toMatchObject({
    first_name: "Erika",
    last_name: "Mustermann",
    nationality: "IT",
    university: "TUM",
    exchange_program: "Erasmus+",
    esn_card: true,
    entry_method: "self",
    recorded_by: null,
  });
  // A trimmed 2-bit PNG of at most 240 × 80 px, about a kilobyte
  const png = decodeGreyPng(row.signature);
  expect(png.bitDepth).toBe(2);
  expect(png.width).toBeLessThanOrEqual(240);
  expect(png.height).toBeLessThanOrEqual(80);
  expect(row.signature.length).toBeLessThan(4000);
  // Something was actually drawn
  expect(Math.min(...png.levels)).toBe(0);
});

test("security: the form never reads the events table or sees organiser names", async ({ page, event }) => {
  const bodies: string[] = [];
  const eventsTableRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/rest/v1/events")) eventsTableRequests.push(req.url());
  });
  page.on("response", async (res) => {
    if (res.url().includes("/rest/v1/")) bodies.push(await res.text().catch(() => ""));
  });

  await page.goto(`/event/${event.public_token}`);
  await expect(page.getByRole("heading", { name: event.title })).toBeVisible();
  await fillForm(page);
  await drawSignature(page);
  await acceptAndSubmit(page);
  await expect(page.getByText("Thank you!")).toBeVisible();

  expect(eventsTableRequests).toEqual([]);
  const everything = bodies.join("\n") + (await page.content());
  expect(everything).not.toContain("Rita Responsible");
  expect(everything).not.toContain("Lea LEI");
});

test("requires a signature", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await fillForm(page);
  await acceptAndSubmit(page);
  await expect(page.getByText("Please provide your signature.")).toBeVisible();
  expect(await rowsFor(event.id)).toEqual([]);
});

test("requires every answer and the disclaimer", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await drawSignature(page);
  await page.getByRole("button", { name: "Submit attendance" }).click();
  await expect(page.getByText("First name is required")).toBeVisible();
  await expect(page.getByText("Please select your university")).toBeVisible();
  await expect(page.getByText("You must accept the disclaimer to continue.")).toBeVisible();
  expect(await rowsFor(event.id)).toEqual([]);
});

test("clearing the pad removes the signature", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await fillForm(page);
  await drawSignature(page);
  await page.getByRole("button", { name: "Clear" }).click();
  await acceptAndSubmit(page);
  await expect(page.getByText("Please provide your signature.")).toBeVisible();
});

test("an unknown or guessed token shows 'Event not found'", async ({ page, event }) => {
  for (const token of ["does-not-exist", event.public_token.slice(0, 16), "%25"]) {
    await page.goto(`/event/${token}`);
    await expect(page.getByText("Event not found.")).toBeVisible();
  }
});

const COOKIE = "mesa_attendance_details";

test("remembers details only after an explicit yes, never the signature", async ({ page, context, event }) => {
  const savedCookie = async () => (await context.cookies()).find((c) => c.name === COOKIE);

  await page.goto(`/event/${event.public_token}`);
  await fillForm(page, { firstName: "Jean", lastName: "Dupont" });
  await drawSignature(page);
  await acceptAndSubmit(page);
  await expect(page.getByText("Save your details for next time?")).toBeVisible();

  // Nothing is stored until they agree
  expect(await savedCookie()).toBeUndefined();

  await page.getByRole("button", { name: "Save my details" }).click();
  const cookie = (await savedCookie())!;
  expect(JSON.parse(decodeURIComponent(cookie.value))).toEqual({
    first_name: "Jean",
    last_name: "Dupont",
    nationality: "IT",
    university: "TUM",
    exchange_program: "Erasmus+",
    esn_card: "yes",
  });
  expect(cookie.value).not.toContain("data%3Aimage");

  // Next event: pre-filled, but signature still required
  await page.goto(`/event/${event.public_token}`);
  await expect(page.locator('input[name="first_name"]')).toHaveValue("Jean");
  await page.locator('input[name="first_name"]').fill("Jeanne");
  await drawSignature(page);
  await acceptAndSubmit(page);

  // Asked again – the changed name is not saved by default
  await expect(page.getByText("Keep your details saved for next time?")).toBeVisible();
  expect(JSON.parse(decodeURIComponent((await savedCookie())!.value)).first_name).toBe("Jean");

  // Saying no withdraws the earlier consent
  await page.getByRole("button", { name: "No, thanks" }).click();
  expect(await savedCookie()).toBeUndefined();
  await page.goto(`/event/${event.public_token}`);
  await expect(page.locator('input[name="first_name"]')).toHaveValue("");
});

test("saying no the first time stores nothing", async ({ page, context, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await fillForm(page);
  await drawSignature(page);
  await acceptAndSubmit(page);
  await page.getByRole("button", { name: "No, thanks" }).click();
  expect((await context.cookies()).find((c) => c.name === COOKIE)).toBeUndefined();
});

test("saved details can be removed from the form without signing in", async ({ page, context, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await fillForm(page);
  await drawSignature(page);
  await acceptAndSubmit(page);
  await page.getByRole("button", { name: "Save my details" }).click();

  await page.goto(`/event/${event.public_token}`);
  await page.getByRole("button", { name: "Not you? Remove saved details" }).click();
  await expect(page.locator('input[name="first_name"]')).toHaveValue("");
  expect((await context.cookies()).find((c) => c.name === COOKIE)).toBeUndefined();
});
