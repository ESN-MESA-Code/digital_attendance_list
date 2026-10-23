// The public attendance form participants open from the QR code.
import type { Page } from "@playwright/test";
import { NOTICE_VERSION, TERMS_VERSION } from "../../lib/legal";
import { admin, createEvent, deleteEvent, hoursFromNow, signOffEvent } from "../helpers/local";
import { acceptAndSubmit, expect, fillForm, test } from "./fixtures";

async function rowsFor(eventId: string) {
  const { data } = await admin.from("participants").select("*").eq("event_id", eventId);
  return data ?? [];
}

test("signs in with the terms version, and nothing like a signature", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await expect(page.getByRole("heading", { name: event.title })).toBeVisible();
  await expect(page.getByLabel("Signature pad")).toHaveCount(0);

  await fillForm(page, { firstName: "Erika", lastName: "Mustermann" });
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
    notice_version: NOTICE_VERSION,
    terms_version: TERMS_VERSION,
  });
  expect(row).not.toHaveProperty("signature");
});

test("the optional questions can be left out or declined", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await fillForm(page, { optional: false });
  await page.getByRole("radiogroup", { name: "ESNcard" }).getByRole("radio", { name: "Prefer not to say" }).check();
  await acceptAndSubmit(page);
  await expect(page.getByText("Thank you!")).toBeVisible();

  const [row] = await rowsFor(event.id);
  expect(row).toMatchObject({ nationality: null, university: null, exchange_program: null, esn_card: null });
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
  await acceptAndSubmit(page);
  await expect(page.getByText("Thank you!")).toBeVisible();

  expect(eventsTableRequests).toEqual([]);
  const everything = bodies.join("\n") + (await page.content());
  expect(everything).not.toContain("Rita Responsible");
});

test("requires a name and the terms; the rest is optional", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("First name is required")).toBeVisible();
  await expect(page.getByText("Please accept the participation terms to sign in.")).toBeVisible();
  await expect(page.getByText("Please select your university")).toHaveCount(0);
  // The legal basis is not consent: there is no consent checkbox.
  await expect(page.getByRole("checkbox", { name: /consent/i })).toHaveCount(0);
  expect(await rowsFor(event.id)).toEqual([]);
});

test("shows the terms with a link to the full text", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await expect(page.getByRole("heading", { name: "Participation terms" })).toBeVisible();
  await expect(page.getByText(`(version ${TERMS_VERSION})`)).toBeVisible();
  const [terms] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "Full participation terms" }).click(),
  ]);
  await expect(terms.getByRole("heading", { level: 1, name: "Participation terms" })).toBeVisible();
  await expect(terms.getByText("Liability of MESA")).toBeVisible();
});

test("shows the event's risk notice and asks to accept it", async ({ page }) => {
  const ev = await createEvent(`Hike ${Date.now()}`, null, { risk_notice: "Steep path – bring hiking boots." });
  try {
    await page.goto(`/event/${ev.public_token}`);
    await expect(page.getByText("Risk notice for this event")).toBeVisible();
    await expect(page.getByText("Steep path – bring hiking boots.")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "I accept the participation terms and the risk notice above." })).toBeVisible();
  } finally {
    await deleteEvent(ev.id);
  }
});

test("before the window it says when sign-ins open", async ({ page }) => {
  const ev = await createEvent(`Later ${Date.now()}`, null, { event_date: hoursFromNow(5) });
  try {
    await page.goto(`/event/${ev.public_token}`);
    await expect(page.getByRole("heading", { name: "Sign-ins are not open yet" })).toBeVisible();
    await expect(page.locator('input[name="first_name"]')).toHaveCount(0);
  } finally {
    await deleteEvent(ev.id);
  }
});

test("24 hours after the event the list is closed", async ({ page }) => {
  const ev = await createEvent(`Past ${Date.now()}`, null, { event_date: hoursFromNow(-25) });
  try {
    await page.goto(`/event/${ev.public_token}`);
    await expect(page.getByRole("heading", { name: "Sign-ins are closed" })).toBeVisible();
  } finally {
    await deleteEvent(ev.id);
  }
});

test("an unknown or guessed token shows 'Event not found'", async ({ page, event }) => {
  for (const token of ["does-not-exist", event.public_token.slice(0, 16), "%25"]) {
    await page.goto(`/event/${token}`);
    await expect(page.getByText("Event not found.")).toBeVisible();
  }
});

const STORAGE_KEY = "mesa_attendance_details";

/** The details saved in this browser's localStorage, or undefined. */
async function savedDetails(page: Page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { savedAt: number; details: Record<string, string> }).details : undefined;
}

test("remembers details only after an explicit yes", async ({ page, context, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await fillForm(page, { firstName: "Jean", lastName: "Dupont" });
  await acceptAndSubmit(page);
  await expect(page.getByText("Save your details for next time?")).toBeVisible();

  // Nothing is stored until they agree
  expect(await savedDetails(page)).toBeUndefined();

  await page.getByRole("button", { name: "Save my details" }).click();
  expect(await savedDetails(page)).toEqual({
    first_name: "Jean",
    last_name: "Dupont",
    nationality: "IT",
    university: "TUM",
    exchange_program: "Erasmus+",
    esn_card: "yes",
  });
  // Kept on the device only: no cookie that would travel to the server.
  expect((await context.cookies()).find((c) => c.name === STORAGE_KEY)).toBeUndefined();

  // Next time: pre-filled, but the terms must be accepted again
  await page.goto(`/event/${event.public_token}`);
  await expect(page.locator('input[name="first_name"]')).toHaveValue("Jean");
  await expect(page.getByRole("checkbox", { name: /I accept the participation terms/ })).not.toBeChecked();
  await page.locator('input[name="first_name"]').fill("Jeanne");
  await acceptAndSubmit(page);

  // Asked again – the changed name is not saved by default
  await expect(page.getByText("Keep your details saved for next time?")).toBeVisible();
  expect((await savedDetails(page))?.first_name).toBe("Jean");

  // Saying no withdraws the earlier consent
  await page.getByRole("button", { name: "No, thanks" }).click();
  expect(await savedDetails(page)).toBeUndefined();
  await page.goto(`/event/${event.public_token}`);
  await expect(page.locator('input[name="first_name"]')).toHaveValue("");
});

test("saying no the first time stores nothing", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await fillForm(page);
  await acceptAndSubmit(page);
  await page.getByRole("button", { name: "No, thanks" }).click();
  expect(await savedDetails(page)).toBeUndefined();
});

test("saved details can be removed from the form without signing in", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await fillForm(page);
  await acceptAndSubmit(page);
  await page.getByRole("button", { name: "Save my details" }).click();

  await page.goto(`/event/${event.public_token}`);
  await page.getByRole("button", { name: "Not you? Remove saved details" }).click();
  await expect(page.locator('input[name="first_name"]')).toHaveValue("");
  expect(await savedDetails(page)).toBeUndefined();
});

test("a sign-off while the form is open closes it on submit", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await fillForm(page);
  await signOffEvent(event.id);
  await acceptAndSubmit(page);
  await expect(page.getByRole("heading", { name: "Sign-ins are closed" })).toBeVisible();
  expect(await rowsFor(event.id)).toEqual([]);
});
