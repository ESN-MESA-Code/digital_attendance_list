// Organisers accept the confidentiality rules once before the organiser area
// opens; until then every organiser page leads to the rules.
import { NEW_ORGANISER, admin, resetNewOrganiser } from "../helpers/local";
import { expect, test } from "./fixtures";

test.beforeEach(resetNewOrganiser);
test.afterEach(resetNewOrganiser);

test("a new organiser accepts the rules, then gets where they wanted to go", async ({
  page,
  event,
  signInAsOrganiser,
}) => {
  await signInAsOrganiser(NEW_ORGANISER);

  await page.goto(`/kiosk/${event.id}`);
  await expect(page).toHaveURL(new RegExp(`/confidentiality\\?next=${encodeURIComponent(`/kiosk/${event.id}`)}`));
  await expect(page.getByRole("heading", { name: "Confidentiality for organisers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vertraulichkeit für Organisator*innen" })).toBeVisible();

  await page.goto("/dashboard/events");
  await expect(page).toHaveURL(/\/confidentiality\?next=%2Fdashboard%2Fevents/);
  await page.getByRole("button", { name: "I accept / Ich akzeptiere" }).click();
  await expect(page).toHaveURL(/\/dashboard\/events$/);
  await expect(page.getByText(event.title)).toBeVisible();

  const { data } = await admin.from("organiser_acknowledgements").select("email").eq("email", NEW_ORGANISER.email);
  expect(data).toHaveLength(1);

  // Accepted once – the page sends them straight on.
  await page.goto("/confidentiality?next=/dashboard/events");
  await expect(page).toHaveURL(/\/dashboard\/events$/);
});

test("the rules page offers to sign out instead", async ({ page, signInAsOrganiser }) => {
  await signInAsOrganiser(NEW_ORGANISER);
  await page.goto("/dashboard/events");
  await page.getByRole("button", { name: "Sign out / Abmelden" }).click();
  await expect(page).toHaveURL(/\/login/);
});
