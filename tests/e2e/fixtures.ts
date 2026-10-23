// Shared steps for the end-to-end tests. (Fixture callbacks are called
// `provide` rather than Playwright's usual `use`, which React's lint rules
// would take for a hook.)
import { expect, test as base, type Page } from "@playwright/test";
import { ORGANISER, createEvent, deleteEvent, organiserSession, sessionCookies, type TestEvent } from "../helpers/local";

export { expect };

export const test = base.extend<{
  event: TestEvent;
  signInAsOrganiser: (who?: typeof ORGANISER) => Promise<void>;
}>({
  // A fresh event per test, starting now (open for sign-ins), deleted afterwards (with its participants).
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

export interface Answers {
  firstName?: string;
  lastName?: string;
  /** Answer the optional questions too (default) or leave them out. */
  optional?: boolean;
}

/** Fills the attendance form (not the terms checkbox). */
export async function fillForm(page: Page, a: Answers = {}) {
  await page.locator('input[name="first_name"]').fill(a.firstName ?? "Erika");
  await page.locator('input[name="last_name"]').fill(a.lastName ?? "Mustermann");
  if (a.optional === false) return;
  const country = page.getByRole("combobox");
  await country.fill("Ital");
  await page.getByRole("option", { name: "Italy" }).click();
  await page.getByRole("radiogroup", { name: "University" }).getByRole("radio", { name: "TUM" }).check();
  await page.getByRole("radiogroup", { name: "Exchange programme" }).getByRole("radio", { name: "Erasmus+" }).check();
  await page.getByRole("radiogroup", { name: "ESNcard" }).getByRole("radio", { name: "Yes" }).check();
}

/** Accepts the participation terms and signs in. */
export async function acceptAndSubmit(page: Page) {
  await page.getByRole("checkbox", { name: /I accept the participation terms/ }).check();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
