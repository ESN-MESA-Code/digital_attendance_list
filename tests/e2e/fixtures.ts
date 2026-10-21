// Shared steps for the end-to-end tests. (Fixture callbacks are called
// `provide` rather than Playwright's usual `use`, which React's lint rules
// would take for a hook.)
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { ORGANISER, createEvent, deleteEvent, organiserSession, sessionCookies, type TestEvent } from "../helpers/local";

export { expect };

export const test = base.extend<{
  event: TestEvent;
  signInAsOrganiser: (who?: typeof ORGANISER) => Promise<void>;
}>({
  // A fresh event per test, deleted afterwards (with its participants).
  event: async ({}, provide) => {
    const event = await createEvent();
    await provide(event);
    await deleteEvent(event.id);
  },
  // Google sign-in is not available locally: put the seeded organiser's
  // session into the cookies @supabase/ssr reads.
  signInAsOrganiser: async ({ context, baseURL }, provide) => {
    await provide(async (who = ORGANISER) => {
      await context.addCookies(sessionCookies(await organiserSession(who), baseURL!));
    });
  },
});

/** Unlocks the pad with a tap, then draws a wavy signature with real pointer moves. */
export async function drawSignature(page: Page, pad: Locator = page.locator("canvas")) {
  await pad.scrollIntoViewIfNeeded();
  const unlock = page.getByRole("button", { name: "Tap here to sign" });
  if (await unlock.isVisible()) await unlock.click();
  const box = (await pad.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.1, y);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    await page.mouse.move(
      box.x + box.width * (0.1 + 0.8 * t),
      y + box.height * 0.3 * Math.sin(t * 12),
      { steps: 2 }
    );
  }
  await page.mouse.up();
}

export interface Answers {
  firstName?: string;
  lastName?: string;
}

/** Fills every question of the attendance form (not the signature). */
export async function fillForm(page: Page, a: Answers = {}) {
  await page.locator('input[name="first_name"]').fill(a.firstName ?? "Erika");
  await page.locator('input[name="last_name"]').fill(a.lastName ?? "Mustermann");
  const country = page.getByRole("combobox");
  await country.fill("Ital");
  await page.getByRole("option", { name: "Italy" }).click();
  await page.getByRole("radio", { name: "TUM" }).check();
  await page.getByRole("radio", { name: "Erasmus+" }).check();
  await page.getByRole("radio", { name: "Yes" }).check();
}

/** Accepts the disclaimer and goes on to the signature page. */
export async function acceptAndContinue(page: Page) {
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to signature →" }).click();
}

export async function submitAttendance(page: Page) {
  await page.getByRole("button", { name: "Submit attendance" }).click();
}

/** The whole sign-in after fillForm: disclaimer, signature, submit. */
export async function acceptSignAndSubmit(page: Page) {
  await acceptAndContinue(page);
  await drawSignature(page);
  await submitAttendance(page);
}
